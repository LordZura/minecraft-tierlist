import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser, logAdminAction } from '@/lib/admin';
import { adminResetWeeklyEventNow } from '@/lib/weekly';

export async function POST(req: NextRequest) {
  const { error, supabase, user } = await requireAdminUser(req);
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : 'Manual admin reset';

  try {
    const result = await adminResetWeeklyEventNow(supabase, user.id, reason);
    await logAdminAction(supabase, {
      actorId: user.id,
      action: 'weekly_reset_now',
      targetTable: 'weekly_pvp_cycles',
      targetId: result.newCycle.id,
      reason,
      meta: { old_cycle_id: result.oldCycleId },
      newValue: result.newCycle,
    });

    return NextResponse.json({ status: 'ok', result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Failed to reset weekly event.' }, { status: 400 });
  }
}
