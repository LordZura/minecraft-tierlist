import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabaseRouteClient';
import { ensureAdmin, ensureSuperAdmin, getRequestUser } from '@/lib/routeAuth';

export async function requireAdminUser(req: NextRequest, requireSuper = false) {
  const supabase = await createSupabaseRouteClient();
  const user = await getRequestUser(req);
  if (!user || !ensureAdmin(user) || (requireSuper && !ensureSuperAdmin(user))) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), supabase: null as any, user: null as any };
  }
  return { error: null as NextResponse | null, supabase, user };
}

export async function logAdminAction(
  supabase: any,
  args: {
    actorId: string;
    action: string;
    targetTable?: string | null;
    targetId?: string | null;
    oldValue?: any;
    newValue?: any;
    reason?: string | null;
    meta?: any;
  },
) {
  await supabase.from('admin_action_logs').insert({
    actor_id: args.actorId,
    action: args.action,
    target_table: args.targetTable ?? null,
    target_id: args.targetId ?? null,
    old_value: args.oldValue ?? null,
    new_value: args.newValue ?? null,
    reason: args.reason ?? null,
    meta: args.meta ?? null,
  });

  await supabase.from('admin_logs').insert({
    admin_id: args.actorId,
    action: args.action,
    target_type: args.targetTable ?? null,
    target_id: args.targetId ?? null,
    details: {
      reason: args.reason ?? null,
      old_value: args.oldValue ?? null,
      new_value: args.newValue ?? null,
      meta: args.meta ?? null,
    },
  });
}
