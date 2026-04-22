import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/admin';

const ENTITY_CONFIG: Record<string, { table: string; order: string }> = {
  users: { table: 'users', order: 'created_at.desc' },
  weekly_cycles: { table: 'weekly_pvp_cycles', order: 'start_at.desc' },
  weekly_assignments: { table: 'weekly_pvp_assignments', order: 'created_at.desc' },
  challenges: { table: 'challenges', order: 'created_at.desc' },
  alerts: { table: 'notifications', order: 'created_at.desc' },
  adjustments: { table: 'admin_user_adjustments', order: 'created_at.desc' },
  fight_logs: { table: 'fight_logs', order: 'created_at.desc' },
  admin_audit: { table: 'admin_action_logs', order: 'created_at.desc' },
};

export async function GET(req: NextRequest) {
  const { error, supabase } = await requireAdminUser(req, true);
  if (error) return error;

  const params = req.nextUrl.searchParams;
  const entity = params.get('entity') || '';
  const limit = Math.min(200, Math.max(1, Number(params.get('limit') || 50)));

  const cfg = ENTITY_CONFIG[entity];
  if (!cfg) return NextResponse.json({ error: 'Unknown entity.' }, { status: 400 });

  const [orderBy, dir] = cfg.order.split('.');
  const q = supabase.from(cfg.table).select('*').order(orderBy, { ascending: dir !== 'desc' }).limit(limit);
  const { data, error: fetchError } = await q;

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 400 });
  return NextResponse.json({ rows: data ?? [] });
}
