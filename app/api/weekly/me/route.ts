import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabaseRouteClient';
import { getRequestUser } from '@/lib/routeAuth';
import { syncWeeklyCycle } from '@/lib/weekly';

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await syncWeeklyCycle(supabase);

  const { data: cycle } = await supabase.from('weekly_pvp_cycles').select('*').eq('status', 'active').order('start_at', { ascending: false }).limit(1).maybeSingle();
  if (!cycle) return NextResponse.json({ cycle: null, assignments: [], progress: [] });

  const { data: assignments } = await supabase
    .from('weekly_pvp_assignments')
    .select('*')
    .eq('cycle_id', cycle.id)
    .or(`player_a.eq.${user.id},player_b.eq.${user.id}`)
    .order('pvp_type');

  const { data: progress } = await supabase
    .from('weekly_pvp_progress')
    .select('*')
    .eq('cycle_id', cycle.id)
    .eq('user_id', user.id)
    .order('pvp_type');

  return NextResponse.json({ cycle, assignments: assignments ?? [], progress: progress ?? [] });
}
