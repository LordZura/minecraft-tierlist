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

  const { data: a } = await supabase.from('weekly_pvp_assignments').select('*').eq('id', assignment_id).single();
  if (!a) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
  if (a.player_a !== user.id && a.player_b !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (a.status === 'completed' || a.status === 'expired') return NextResponse.json({ error: 'Already resolved' }, { status: 400 });
  if (winner_id !== a.player_a && winner_id !== a.player_b) return NextResponse.json({ error: 'Invalid winner' }, { status: 400 });
  if (!a.a_ready_at || !a.b_ready_at) return NextResponse.json({ error: 'Both players must be ready first.' }, { status: 400 });

  await markWeeklyMatchComplete(supabase, assignment_id, winner_id, 'played', 3);
  return NextResponse.json({ status: 'ok' });
}
