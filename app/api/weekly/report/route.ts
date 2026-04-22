import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabaseRouteClient';
import { getRequestUser } from '@/lib/routeAuth';
import { markWeeklyMatchComplete } from '@/lib/weekly';

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { assignment_id, winner_id } = await req.json();
  if (!assignment_id || !winner_id) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const { data: assignment } = await supabase.from('weekly_pvp_assignments').select('*').eq('id', assignment_id).single();
  if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
  if (assignment.player_a !== user.id && assignment.player_b !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (assignment.status === 'completed' || assignment.status === 'expired') return NextResponse.json({ error: 'Already resolved' }, { status: 400 });
  if (winner_id !== assignment.player_a && winner_id !== assignment.player_b) return NextResponse.json({ error: 'Invalid winner' }, { status: 400 });
  if (!assignment.a_ready_at || !assignment.b_ready_at) return NextResponse.json({ error: 'Both players must confirm ready first.' }, { status: 400 });

  await markWeeklyMatchComplete(supabase, assignment_id, winner_id, 'played');
  return NextResponse.json({ status: 'ok' });
}
