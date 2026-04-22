import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabaseRouteClient';
import { getRequestUser } from '@/lib/routeAuth';

const NUMERIC_FIELDS = [
  'total_points_override',
  'total_wins_override',
  'total_losses_override',
  'elo_overall_override',
  'elo_average_override',
  'elo_crystal_override',
  'elo_sword_override',
  'elo_axe_override',
  'elo_uhc_override',
  'elo_manhunt_override',
  'elo_mace_override',
  'elo_smp_override',
  'elo_cart_override',
  'elo_bow_override',
] as const;

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const actor = await getRequestUser(req);

  if (!actor?.is_admin) return NextResponse.json({ error: 'Admin only.' }, { status: 403 });

  const body = await req.json();
  const { user_id, reason } = body;
  if (!user_id) return NextResponse.json({ error: 'Missing user_id.' }, { status: 400 });

  const payload: Record<string, number | null | string> = { user_id };

  for (const field of NUMERIC_FIELDS) {
    const value = body[field];
    if (value === null || value === undefined || value === '') {
      payload[field] = null;
      continue;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return NextResponse.json({ error: `Invalid number: ${field}` }, { status: 400 });
    }
    if (field.includes('elo_') && (parsed < 0 || parsed > 4000)) {
      return NextResponse.json({ error: `${field} must be between 0 and 4000.` }, { status: 400 });
    }
    payload[field] = Math.round(parsed);
  }

  const { data: previous } = await supabase.from('user_admin_overrides').select('*').eq('user_id', user_id).maybeSingle();

  const { data, error } = await supabase
    .from('user_admin_overrides')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from('admin_override_history').insert({
    admin_id: actor.id,
    user_id,
    previous_values: previous ?? {},
    new_values: data,
    reason: typeof reason === 'string' ? reason.slice(0, 500) : null,
  });

  await supabase.from('admin_logs').insert({
    admin_id: actor.id,
    action: 'set_user_override',
    target_type: 'user',
    target_id: user_id,
    details: { reason: reason ?? null, changes: data },
  });

  return NextResponse.json({ status: 'ok', override: data });
}
