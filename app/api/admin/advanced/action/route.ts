import { NextRequest, NextResponse } from 'next/server';
import { adminResetWeeklyEventNow } from '@/lib/weekly';
import { logAdminAction, requireAdminUser } from '@/lib/admin';

export async function POST(req: NextRequest) {
  const { error, supabase, user } = await requireAdminUser(req, true);
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const action = body.action as string;
  const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : 'Advanced action';

  try {
    if (action === 'reset_weekly_now') {
      const result = await adminResetWeeklyEventNow(supabase, user.id, reason);
      await logAdminAction(supabase, {
        actorId: user.id,
        action,
        targetTable: 'weekly_pvp_cycles',
        targetId: result.newCycle.id,
        reason,
        meta: { old_cycle_id: result.oldCycleId },
      });
      return NextResponse.json({ status: 'ok', result });
    }

    if (action === 'mark_cycle_completed') {
      const cycleId = body.cycle_id as string;
      if (!cycleId) return NextResponse.json({ error: 'Missing cycle_id.' }, { status: 400 });
      await supabase.from('weekly_pvp_cycles').update({ status: 'completed', finalized_at: new Date().toISOString() }).eq('id', cycleId);
      await logAdminAction(supabase, { actorId: user.id, action, targetTable: 'weekly_pvp_cycles', targetId: cycleId, reason });
      return NextResponse.json({ status: 'ok' });
    }

    if (action === 'cancel_weekly_matchup') {
      const assignmentId = body.assignment_id as string;
      if (!assignmentId) return NextResponse.json({ error: 'Missing assignment_id.' }, { status: 400 });
      await supabase
        .from('weekly_pvp_assignments')
        .update({ status: 'cancelled', win_type: 'admin_cancelled', resolved_at: new Date().toISOString() })
        .eq('id', assignmentId)
        .in('status', ['pending', 'ready']);
      await logAdminAction(supabase, { actorId: user.id, action, targetTable: 'weekly_pvp_assignments', targetId: assignmentId, reason });
      return NextResponse.json({ status: 'ok' });
    }

    if (action === 'resend_alert') {
      const notificationId = body.notification_id as string;
      if (!notificationId) return NextResponse.json({ error: 'Missing notification_id.' }, { status: 400 });
      const { data } = await supabase.from('notifications').select('*').eq('id', notificationId).maybeSingle();
      if (!data) return NextResponse.json({ error: 'Notification not found.' }, { status: 404 });
      const inserted = await supabase.from('notifications').insert({
        user_id: data.user_id,
        type: data.type,
        related_id: data.related_id,
        message: data.message,
        dedupe_key: null,
      }).select('*').single();
      await logAdminAction(supabase, { actorId: user.id, action, targetTable: 'notifications', targetId: notificationId, reason, newValue: inserted.data });
      return NextResponse.json({ status: 'ok', notification: inserted.data });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Action failed.' }, { status: 400 });
  }
}
