import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabaseRouteClient';
import { getRequestUser } from '@/lib/routeAuth';
import { getMatchupKey, syncWeeklyCycle } from '@/lib/weekly';

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await syncWeeklyCycle(supabase);

  let { data: cycle } = await supabase
    .from('weekly_pvp_cycles')
    .select('*')
    .eq('status', 'active')
    .order('start_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!cycle) {
    const fallback = await supabase
      .from('weekly_pvp_cycles')
      .select('*')
      .order('start_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    cycle = fallback.data;
  }

  if (!cycle) return NextResponse.json({ cycle: null, assignments: [], progress: [], history: [] });

  const { data: assignments } = await supabase
    .from('weekly_pvp_assignments')
    .select('*')
    .eq('cycle_id', cycle.id)
    .or(`player_a.eq.${user.id},player_b.eq.${user.id}`)
    .order('pvp_type')
    .order('round_number');

  const { data: progress } = await supabase
    .from('weekly_pvp_progress')
    .select('*')
    .eq('cycle_id', cycle.id)
    .eq('user_id', user.id)
    .order('pvp_type');

  const { data: users } = await supabase.from('users').select('id,username');
  const userMap = Object.fromEntries((users ?? []).map((u: any) => [u.id, u.username]));

  const enrichedAssignments = (assignments ?? []).map((a: any) => ({
    ...a,
    player_a_name: userMap[a.player_a] ?? 'Unknown',
    player_b_name: userMap[a.player_b] ?? 'Unknown',
  }));

  const grouped = Object.values(
    enrichedAssignments.reduce((acc: Record<string, any>, row: any) => {
      const key = getMatchupKey(row);
      const meIsA = row.player_a === user.id;
      if (!acc[key]) {
        acc[key] = {
          id: row.id,
          cycle_id: row.cycle_id,
          pvp_type: row.pvp_type,
          player_a: row.player_a,
          player_b: row.player_b,
          player_a_name: row.player_a_name,
          player_b_name: row.player_b_name,
          my_ready: !!(meIsA ? row.a_ready_at : row.b_ready_at),
          opponent_ready: !!(meIsA ? row.b_ready_at : row.a_ready_at),
          ready_by_at: row.ready_by_at,
          unresolved_rounds: 0,
          completed_rounds: 0,
          my_wins: 0,
          opponent_wins: 0,
          status: 'pending',
          has_default: false,
        };
      }

      const item = acc[key];
      if (row.status === 'pending' || row.status === 'ready') {
        item.unresolved_rounds += 1;
        item.id = row.id;
      }
      if (row.status === 'completed') {
        item.completed_rounds += 1;
        const winnerIsMe = row.winner === user.id;
        if (winnerIsMe) item.my_wins += 1;
        else item.opponent_wins += 1;
        if (row.win_type === 'default') item.has_default = true;
      }
      if (row.ready_by_at && (!item.ready_by_at || new Date(row.ready_by_at).getTime() > new Date(item.ready_by_at).getTime())) {
        item.ready_by_at = row.ready_by_at;
      }
      return acc;
    }, {}),
  ).map((item: any) => {
    const readyState = item.my_ready && item.opponent_ready;
    const status =
      item.unresolved_rounds === 0
        ? item.has_default
          ? 'default_win'
          : 'completed'
        : readyState
          ? 'both_ready'
          : item.my_ready
            ? 'waiting_for_opponent'
            : item.opponent_ready
              ? 'waiting_for_you'
              : 'result_pending';
    return { ...item, status };
  });

  const { data: history } = await supabase
    .from('weekly_pvp_cycles')
    .select('id,start_at,end_at,status,selected_pvp_types,finalized_at')
    .order('start_at', { ascending: false })
    .limit(6);

  return NextResponse.json({ cycle, assignments: grouped, progress: progress ?? [], history: history ?? [] });
}
