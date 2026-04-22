import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabaseRouteClient';
import { getRequestUser } from '@/lib/routeAuth';
import { getMatchupKey, resolveWeeklyTimeouts } from '@/lib/weekly';

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { assignment_id } = await req.json();
  if (!assignment_id) return NextResponse.json({ error: 'Missing assignment_id' }, { status: 400 });

  const { data: assignment } = await supabase.from('weekly_pvp_assignments').select('*').eq('id', assignment_id).single();
  if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
  if (assignment.status === 'completed' || assignment.status === 'expired' || assignment.status === 'cancelled') return NextResponse.json({ error: 'Assignment already resolved' }, { status: 400 });
  if (assignment.player_a !== user.id && assignment.player_b !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { data: cycle } = await supabase.from('weekly_pvp_cycles').select('id,status').eq('id', assignment.cycle_id).maybeSingle();
  if (!cycle || cycle.status !== 'active') return NextResponse.json({ error: 'Weekly cycle is not active.' }, { status: 400 });

  const now = new Date().toISOString();
  const meIsA = assignment.player_a === user.id;

  const { data: cycleRows } = await supabase
    .from('weekly_pvp_assignments')
    .select('*')
    .eq('cycle_id', assignment.cycle_id)
    .eq('pvp_type', assignment.pvp_type)
    .in('status', ['pending', 'ready']);

  const matchupRows = (cycleRows ?? []).filter((row: any) => getMatchupKey(row) === getMatchupKey(assignment));
  if (matchupRows.length === 0) return NextResponse.json({ status: 'ok', duplicate: true });

  const myReadyAlready = matchupRows.every((row: any) => (meIsA ? row.a_ready_at : row.b_ready_at));
  if (myReadyAlready) {
    await resolveWeeklyTimeouts(supabase, assignment.cycle_id);
    return NextResponse.json({ status: 'ok', duplicate: true });
  }

  const opponentReadyForAll = matchupRows.every((row: any) => (meIsA ? row.b_ready_at : row.a_ready_at));
  const patch: any = meIsA ? { a_ready_at: now } : { b_ready_at: now };
  if (opponentReadyForAll) {
    patch.status = 'ready';
    patch.ready_by_at = null;
  } else {
    patch.status = 'pending';
    patch.ready_by_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }

  await supabase
    .from('weekly_pvp_assignments')
    .update(patch)
    .in(
      'id',
      matchupRows.map((row: any) => row.id),
    )
    .in('status', ['pending', 'ready']);

  if (!opponentReadyForAll) {
    const opponentId = meIsA ? assignment.player_b : assignment.player_a;
    await supabase.from('notifications').upsert(
      {
        user_id: opponentId,
        type: 'weekly_opponent_waiting',
        related_id: assignment_id,
        message: `Your opponent is ready for weekly ${assignment.pvp_type} matchup. Confirm within 24h.`,
        dedupe_key: `weekly_opponent_waiting:${assignment.cycle_id}:${assignment.pvp_type}:${opponentId}:${getMatchupKey(assignment)}`,
      },
      { onConflict: 'user_id,dedupe_key' },
    );
  }

  await resolveWeeklyTimeouts(supabase, assignment.cycle_id);

  return NextResponse.json({ status: 'ok' });
}
