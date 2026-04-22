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

  const { data: a } = await supabase.from('weekly_pvp_assignments').select('*').eq('id', assignment_id).single();
  if (!a) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
  if (a.status === 'completed' || a.status === 'expired') return NextResponse.json({ error: 'Assignment already resolved' }, { status: 400 });
  if (a.player_a !== user.id && a.player_b !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const patch: any = {};
  if (a.player_a === user.id && !a.a_ready_at) patch.a_ready_at = new Date().toISOString();
  if (a.player_b === user.id && !a.b_ready_at) patch.b_ready_at = new Date().toISOString();
  if (!Object.keys(patch).length) return NextResponse.json({ status: 'ok' });

  patch.status = (a.player_a === user.id ? !!a.b_ready_at : !!a.a_ready_at) ? 'ready' : 'pending';

  await supabase.from('weekly_pvp_assignments').update(patch).eq('id', assignment_id);
  await resolveWeeklyTimeouts(supabase, a.cycle_id);

  return NextResponse.json({ status: 'ok' });
}
