import { PVP_TYPES, type PvpType } from '@/lib/pvp';

type SB = any;

const MS_IN_DAY = 24 * 60 * 60 * 1000;
const MS_IN_WEEK = 7 * MS_IN_DAY;
const ELO_PENALTY_PER_UNPLAYED_TYPE = -12;

function getCycleWindow(now = new Date()) {
  const t = now.getTime();
  const startTs = t - (t % MS_IN_WEEK);
  const endTs = startTs + MS_IN_WEEK;
  return { start: new Date(startTs), end: new Date(endTs) };
}

export async function syncWeeklyCycle(supabase: SB) {
  const now = new Date();
  const { start, end } = getCycleWindow(now);

  const { data: existing } = await supabase
    .from('weekly_pvp_cycles')
    .select('*')
    .eq('start_at', start.toISOString())
    .maybeSingle();

  let cycle = existing;
  if (!cycle) {
    const { data: created, error } = await supabase
      .from('weekly_pvp_cycles')
      .insert({ start_at: start.toISOString(), end_at: end.toISOString(), status: 'active', required_rounds_per_type: 3 })
      .select('*')
      .single();
    if (error) throw error;
    cycle = created;
  }

  await supabase
    .from('weekly_pvp_cycles')
    .update({ status: 'completed', finalized_at: now.toISOString() })
    .lt('end_at', now.toISOString())
    .neq('id', cycle.id)
    .neq('status', 'completed');

  await ensureCycleAssignments(supabase, cycle.id);
  await resolveWeeklyTimeouts(supabase, cycle.id);
  await finalizeExpiredCycles(supabase, now);

  return cycle;
}

async function ensureCycleAssignments(supabase: SB, cycleId: string) {
  const { data: existing } = await supabase
    .from('weekly_pvp_assignments')
    .select('id')
    .eq('cycle_id', cycleId)
    .limit(1);
  if (existing && existing.length > 0) return;

  const { data: users } = await supabase.from('users').select('id').order('created_at');
  const ids = (users ?? []).map((u: any) => u.id);
  if (ids.length < 2) return;

  const shuffled = [...ids].sort(() => Math.random() - 0.5);
  const insertRows: any[] = [];

  for (const pvpType of PVP_TYPES) {
    const typePlayers = [...shuffled];
    if (typePlayers.length % 2 === 1) typePlayers.pop();
    for (let i = 0; i < typePlayers.length; i += 2) {
      insertRows.push({
        cycle_id: cycleId,
        pvp_type: pvpType,
        player_a: typePlayers[i],
        player_b: typePlayers[i + 1],
        ready_deadline_at: new Date(Date.now() + MS_IN_DAY).toISOString(),
        status: 'pending',
        rounds_awarded: 3,
      });
    }
  }

  if (insertRows.length > 0) {
    await supabase.from('weekly_pvp_assignments').insert(insertRows);
  }

  const progressRows: any[] = [];
  for (const userId of ids) {
    for (const pvpType of PVP_TYPES) {
      progressRows.push({ cycle_id: cycleId, user_id: userId, pvp_type: pvpType, required_rounds: 3, completed_rounds: 0 });
    }
  }
  await supabase.from('weekly_pvp_progress').upsert(progressRows, { onConflict: 'cycle_id,user_id,pvp_type' });
}

export async function resolveWeeklyTimeouts(supabase: SB, cycleId: string) {
  const nowIso = new Date().toISOString();
  const { data: rows } = await supabase
    .from('weekly_pvp_assignments')
    .select('*')
    .eq('cycle_id', cycleId)
    .in('status', ['pending', 'ready'])
    .lt('ready_deadline_at', nowIso);

  for (const row of rows ?? []) {
    const aReady = !!row.a_ready_at;
    const bReady = !!row.b_ready_at;
    if (aReady === bReady) {
      await supabase.from('weekly_pvp_assignments').update({ status: 'expired', resolved_at: nowIso, win_type: 'no_ready' }).eq('id', row.id);
      continue;
    }
    const winner = aReady ? row.player_a : row.player_b;
    await markWeeklyMatchComplete(supabase, row.id, winner, 'default', row.rounds_awarded ?? 3);
  }
}

export async function markWeeklyMatchComplete(supabase: SB, assignmentId: string, winnerId: string, winType: 'played' | 'default', roundsAwarded: number) {
  const nowIso = new Date().toISOString();
  const { data: assignment } = await supabase.from('weekly_pvp_assignments').select('*').eq('id', assignmentId).single();
  if (!assignment || assignment.status === 'completed') return;

  await supabase
    .from('weekly_pvp_assignments')
    .update({ status: 'completed', winner: winnerId, win_type: winType, resolved_at: nowIso })
    .eq('id', assignmentId)
    .in('status', ['pending', 'ready']);

  for (const userId of [assignment.player_a, assignment.player_b]) {
    const { data: progress } = await supabase
      .from('weekly_pvp_progress')
      .select('*')
      .eq('cycle_id', assignment.cycle_id)
      .eq('user_id', userId)
      .eq('pvp_type', assignment.pvp_type)
      .maybeSingle();

    if (!progress) continue;
    const nextRounds = Math.min(progress.required_rounds, (progress.completed_rounds ?? 0) + roundsAwarded);
    await supabase
      .from('weekly_pvp_progress')
      .update({ completed_rounds: nextRounds, completed_at: nextRounds >= progress.required_rounds ? nowIso : null })
      .eq('cycle_id', assignment.cycle_id)
      .eq('user_id', userId)
      .eq('pvp_type', assignment.pvp_type);
  }
}

async function finalizeExpiredCycles(supabase: SB, now: Date) {
  const { data: oldCycles } = await supabase
    .from('weekly_pvp_cycles')
    .select('*')
    .lt('end_at', now.toISOString())
    .neq('status', 'completed');

  for (const cycle of oldCycles ?? []) {
    const { data: incomplete } = await supabase
      .from('weekly_pvp_progress')
      .select('*')
      .eq('cycle_id', cycle.id)
      .lt('completed_rounds', 3)
      .eq('penalty_applied', false);

    for (const row of incomplete ?? []) {
      await supabase.from('weekly_pvp_penalties').upsert({ cycle_id: cycle.id, user_id: row.user_id, pvp_type: row.pvp_type, elo_delta: ELO_PENALTY_PER_UNPLAYED_TYPE }, { onConflict: 'cycle_id,user_id,pvp_type' });
      await supabase
        .from('weekly_pvp_progress')
        .update({ penalty_applied: true })
        .eq('cycle_id', cycle.id)
        .eq('user_id', row.user_id)
        .eq('pvp_type', row.pvp_type);
    }

    await supabase.from('weekly_pvp_cycles').update({ status: 'completed', finalized_at: now.toISOString() }).eq('id', cycle.id);
  }
}

export function validateRounds(a: unknown, b: unknown) {
  const aNum = Number(a);
  const bNum = Number(b);
  if (!Number.isInteger(aNum) || !Number.isInteger(bNum)) return { error: 'Rounds must be whole numbers.' };
  if (aNum < 0 || bNum < 0) return { error: 'Rounds cannot be negative.' };
  if (aNum === bNum) return { error: 'Round ties are not allowed.' };
  if (aNum > 10 || bNum > 10) return { error: 'Rounds exceed allowed limit.' };
  return { challengerRounds: aNum, challengedRounds: bNum };
}

export function resolveWinnerFromRounds(challengerId: string, challengedId: string, challengerRounds: number, challengedRounds: number) {
  return challengerRounds > challengedRounds ? challengerId : challengedId;
}
