import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabaseRouteClient';
import { getRequestUser } from '@/lib/routeAuth';
import { resolveWeeklyTimeouts } from '@/lib/weekly';

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { assignment_id } = await req.json();
  if (!assignment_id) return NextResponse.json({ error: 'Missing assignment_id' }, { status: 400 });

  const { data: assignment } = await supabase.from('weekly_pvp_assignments').select('*').eq('id', assignment_id).single();
  if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
  if (assignment.status === 'completed' || assignment.status === 'expired') return NextResponse.json({ error: 'Assignment already resolved' }, { status: 400 });
  if (assignment.player_a !== user.id && assignment.player_b !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const now = new Date().toISOString();
  const meIsA = assignment.player_a === user.id;
  const myReady = meIsA ? assignment.a_ready_at : assignment.b_ready_at;

  if (myReady) {
    await resolveWeeklyTimeouts(supabase, assignment.cycle_id);
    return NextResponse.json({ status: 'ok', duplicate: true });
  }

  const patch: any = meIsA ? { a_ready_at: now } : { b_ready_at: now };
  const opponentReady = meIsA ? assignment.b_ready_at : assignment.a_ready_at;

  if (opponentReady) {
    patch.status = 'ready';
  } else {
    patch.status = 'pending';
    patch.ready_by_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }

  const { data: updated } = await supabase
    .from('weekly_pvp_assignments')
    .update(patch)
    .eq('id', assignment_id)
    .in('status', ['pending', 'ready'])
    .select('*')
    .single();

  if (!updated) return NextResponse.json({ status: 'ok', duplicate: true });

  if (!opponentReady) {
    const opponentId = meIsA ? assignment.player_b : assignment.player_a;
    await supabase.from('notifications').upsert(
      {
        user_id: opponentId,
        type: 'weekly_opponent_waiting',
        related_id: assignment_id,
        message: `Your opponent is ready for weekly ${assignment.pvp_type} round ${assignment.round_number}. Confirm within 24h.`,
        dedupe_key: `weekly_opponent_waiting:${assignment_id}:${opponentId}`,
      },
      { onConflict: 'user_id,dedupe_key' },
    );
  }

  await resolveWeeklyTimeouts(supabase, assignment.cycle_id);

  return NextResponse.json({ status: 'ok' });
}
