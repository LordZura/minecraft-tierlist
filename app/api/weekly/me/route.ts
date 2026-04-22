import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabaseRouteClient';
import { getRequestUser } from '@/lib/routeAuth';
import { syncWeeklyCycle } from '@/lib/weekly';

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await syncWeeklyCycle(supabase);

  const { data: cycle } = await supabase
    .from('weekly_pvp_cycles')
    .select('*')
    .eq('status', 'active')
    .order('start_at', { ascending: false })
    .limit(1)
    .maybeSingle();

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

  const { data: history } = await supabase
    .from('weekly_pvp_cycles')
    .select('id,start_at,end_at,status,selected_pvp_types,finalized_at')
    .order('start_at', { ascending: false })
    .limit(6);

  return NextResponse.json({ cycle, assignments: enrichedAssignments, progress: progress ?? [], history: history ?? [] });
}
