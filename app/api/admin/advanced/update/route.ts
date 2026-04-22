import { NextRequest, NextResponse } from 'next/server';
import { logAdminAction, requireAdminUser } from '@/lib/admin';

const UPDATE_CONFIG: Record<string, { table: string; idField: string; editable: string[] }> = {
  users: {
    table: 'users',
    idField: 'id',
    editable: ['is_admin', 'is_super_admin', 'username'],
  },
  weekly_cycles: {
    table: 'weekly_pvp_cycles',
    idField: 'id',
    editable: ['status', 'end_at', 'finalized_at', 'required_rounds_per_type', 'selected_pvp_types', 'reset_reason'],
  },
  weekly_assignments: {
    table: 'weekly_pvp_assignments',
    idField: 'id',
    editable: ['status', 'winner', 'win_type', 'a_ready_at', 'b_ready_at', 'ready_by_at', 'resolved_at'],
  },
  challenges: {
    table: 'challenges',
    idField: 'id',
    editable: ['status', 'winner', 'challenger_wins', 'challenged_wins', 'completed_at', 'pvp_type'],
  },
  alerts: {
    table: 'notifications',
    idField: 'id',
    editable: ['read', 'type', 'message', 'related_id', 'dedupe_key'],
  },
  adjustments: {
    table: 'admin_user_adjustments',
    idField: 'id',
    editable: ['points_delta', 'elo_overall_delta', 'elo_average_delta', 'elo_crystal_delta', 'elo_sword_delta', 'elo_axe_delta', 'elo_uhc_delta', 'elo_manhunt_delta', 'elo_mace_delta', 'elo_smp_delta', 'elo_cart_delta', 'elo_bow_delta', 'reason'],
  },
};

export async function POST(req: NextRequest) {
  const { error, supabase, user } = await requireAdminUser(req, true);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const entity = body?.entity;
  const id = body?.id;
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  const changes = body?.changes;

  if (!entity || !id || !changes || typeof changes !== 'object') {
    return NextResponse.json({ error: 'Missing entity/id/changes.' }, { status: 400 });
  }

  const cfg = UPDATE_CONFIG[entity];
  if (!cfg) return NextResponse.json({ error: 'Entity not editable.' }, { status: 400 });

  const patch: Record<string, any> = {};
  for (const [k, v] of Object.entries(changes)) {
    if (!cfg.editable.includes(k)) continue;
    patch[k] = v;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No allowed fields in changes.' }, { status: 400 });
  }

  const { data: before } = await supabase.from(cfg.table).select('*').eq(cfg.idField, id).maybeSingle();
  if (!before) return NextResponse.json({ error: 'Record not found.' }, { status: 404 });

  const { data: updated, error: updateError } = await supabase
    .from(cfg.table)
    .update(patch)
    .eq(cfg.idField, id)
    .select('*')
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  await logAdminAction(supabase, {
    actorId: user.id,
    action: `advanced_update_${entity}`,
    targetTable: cfg.table,
    targetId: String(id),
    reason: reason || 'Advanced manual update',
    oldValue: before,
    newValue: updated,
    meta: { changed_fields: Object.keys(patch) },
  });

  return NextResponse.json({ status: 'ok', row: updated });
}
