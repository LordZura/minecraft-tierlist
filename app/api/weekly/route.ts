import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabaseRouteClient';
import { getRequestUser } from '@/lib/routeAuth';
import { ensureWeeklyCycle } from '@/lib/weeklyCycle';

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cycle = await ensureWeeklyCycle(supabase);
  if (!cycle) return NextResponse.json({ error: 'Unable to initialize cycle.' }, { status: 500 });

  const [{ data: requirements }, { data: assignments }] = await Promise.all([
    supabase.from('weekly_cycle_requirements').select('*').eq('cycle_id', cycle.id),
    supabase
      .from('weekly_assignments')
      .select('*, a:users!weekly_assignments_player_a_fkey(username), b:users!weekly_assignments_player_b_fkey(username), w:users!weekly_assignments_winner_fkey(username)')
      .eq('cycle_id', cycle.id)
      .or(`player_a.eq.${user.id},player_b.eq.${user.id}`)
      .order('created_at', { ascending: true }),
  ]);

  return NextResponse.json({ cycle, requirements: requirements ?? [], assignments: assignments ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cycle = await ensureWeeklyCycle(supabase);
  if (!cycle) return NextResponse.json({ error: 'No active cycle.' }, { status: 400 });

  const body = await req.json();
  const { action, assignment_id, rounds_a, rounds_b } = body;

  const { data: assignment } = await supabase.from('weekly_assignments').select('*').eq('id', assignment_id).single();
  if (!assignment || assignment.cycle_id !== cycle.id) return NextResponse.json({ error: 'Assignment not found.' }, { status: 404 });
  if (assignment.player_a !== user.id && assignment.player_b !== user.id) return NextResponse.json({ error: 'Not your assignment.' }, { status: 403 });

  const now = new Date();

  if (action === 'confirm_ready') {
    const readyField = assignment.player_a === user.id ? 'ready_a_at' : 'ready_b_at';
    const patch: any = { [readyField]: now.toISOString() };
    if (assignment.ready_a_at || assignment.ready_b_at) patch.status = 'ready';
    await supabase.from('weekly_assignments').update(patch).eq('id', assignment.id);
    return NextResponse.json({ status: 'ok' });
  }

  if (action === 'submit_result') {
    if (!assignment.ready_a_at || !assignment.ready_b_at) return NextResponse.json({ error: 'Both players must be ready.' }, { status: 400 });
    const ra = Number(rounds_a);
    const rb = Number(rounds_b);
    if (!Number.isInteger(ra) || !Number.isInteger(rb) || ra < 0 || rb < 0 || ra > 10 || rb > 10 || ra === rb || (ra + rb === 0)) {
      return NextResponse.json({ error: 'Invalid round result.' }, { status: 400 });
    }

    const winner = ra > rb ? assignment.player_a : assignment.player_b;
    await supabase.from('weekly_assignments').update({
      rounds_a: ra,
      rounds_b: rb,
      status: 'played',
      winner,
      win_reason: 'played',
      resolved_at: now.toISOString(),
    }).eq('id', assignment.id);
    return NextResponse.json({ status: 'ok' });
  }

  if (action === 'resolve_timeout') {
    if (now <= new Date(assignment.ready_deadline_at)) return NextResponse.json({ error: 'Deadline not reached.' }, { status: 400 });

    const aReady = !!assignment.ready_a_at;
    const bReady = !!assignment.ready_b_at;
    if (aReady && !bReady) {
      await supabase.from('weekly_assignments').update({
        status: 'default_win',
        winner: assignment.player_a,
        win_reason: 'opponent_not_ready_24h',
        rounds_a: 3,
        rounds_b: 0,
        resolved_at: now.toISOString(),
      }).eq('id', assignment.id);
      return NextResponse.json({ status: 'ok' });
    }
    if (!aReady && bReady) {
      await supabase.from('weekly_assignments').update({
        status: 'default_win',
        winner: assignment.player_b,
        win_reason: 'opponent_not_ready_24h',
        rounds_a: 0,
        rounds_b: 3,
        resolved_at: now.toISOString(),
      }).eq('id', assignment.id);
      return NextResponse.json({ status: 'ok' });
    }

    await supabase.from('weekly_assignments').update({
      status: 'expired_both_unready',
      win_reason: 'both_unready',
      resolved_at: now.toISOString(),
    }).eq('id', assignment.id);

    return NextResponse.json({ status: 'ok' });
  }

  return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
}
