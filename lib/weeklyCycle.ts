import type { SupabaseClient } from '@supabase/supabase-js';
import { PVP_TYPES } from '@/lib/pvp';

const CYCLE_DAYS = 7;
const READY_HOURS = 24;
const PENALTY_PER_MISSING_TYPE = -15;

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function createAssignmentsForType(supabase: SupabaseClient, cycleId: string, pvpType: string, userIds: string[]) {
  const shuffled = shuffle(userIds);
  const now = new Date();
  const deadline = new Date(now.getTime() + READY_HOURS * 60 * 60 * 1000).toISOString();
  const inserts: any[] = [];

  for (let i = 0; i < shuffled.length; i += 2) {
    const a = shuffled[i];
    const b = shuffled[i + 1];
    if (!a) continue;

    if (!b) {
      inserts.push({
        cycle_id: cycleId,
        pvp_type: pvpType,
        player_a: a,
        player_b: null,
        status: 'default_win',
        winner: a,
        win_reason: 'bye',
        rounds_a: 3,
        rounds_b: 0,
        ready_deadline_at: deadline,
        resolved_at: new Date().toISOString(),
      });
      continue;
    }

    inserts.push({
      cycle_id: cycleId,
      pvp_type: pvpType,
      player_a: a,
      player_b: b,
      status: 'assigned',
      ready_deadline_at: deadline,
    });
  }

  if (inserts.length > 0) {
    await supabase.from('weekly_assignments').insert(inserts);
  }
}

async function generateCycle(supabase: SupabaseClient, startAt: Date) {
  const endAt = addDays(startAt, CYCLE_DAYS);
  const { data: cycle } = await supabase
    .from('weekly_pvp_cycles')
    .insert({ start_at: startAt.toISOString(), end_at: endAt.toISOString(), status: 'active' })
    .select('*')
    .single();

  if (!cycle) return null;

  await supabase.from('weekly_cycle_requirements').insert(
    PVP_TYPES.map((type) => ({ cycle_id: cycle.id, pvp_type: type, rounds_required: 3 })),
  );

  const { data: users } = await supabase.from('users').select('id');
  const userIds = (users ?? []).map((u: any) => u.id);

  for (const type of PVP_TYPES) {
    await createAssignmentsForType(supabase, cycle.id, type, userIds);
  }

  return cycle;
}

async function finalizeExpiredCycles(supabase: SupabaseClient, now: Date) {
  const { data: expiredCycles } = await supabase
    .from('weekly_pvp_cycles')
    .select('*')
    .eq('status', 'active')
    .lt('end_at', now.toISOString());

  for (const cycle of expiredCycles ?? []) {
    await supabase.from('weekly_pvp_cycles').update({ status: 'completed', finalized_at: now.toISOString() }).eq('id', cycle.id);

    if (cycle.penalties_applied) continue;

    const [{ data: users }, { data: requirements }, { data: assignments }] = await Promise.all([
      supabase.from('users').select('id'),
      supabase.from('weekly_cycle_requirements').select('pvp_type,rounds_required').eq('cycle_id', cycle.id),
      supabase.from('weekly_assignments').select('*').eq('cycle_id', cycle.id),
    ]);

    for (const user of users ?? []) {
      for (const req of requirements ?? []) {
        const played = (assignments ?? []).reduce((acc: number, row: any) => {
          if (row.pvp_type !== req.pvp_type) return acc;
          if (row.player_a !== user.id && row.player_b !== user.id) return acc;
          if (!['played', 'default_win'].includes(row.status)) return acc;

          if (row.player_a === user.id) return acc + (row.rounds_a ?? 0);
          if (row.player_b === user.id) return acc + (row.rounds_b ?? 0);
          return acc;
        }, 0);

        if (played < req.rounds_required) {
          await supabase.from('elo_adjustments').upsert(
            {
              user_id: user.id,
              pvp_type: req.pvp_type,
              delta: PENALTY_PER_MISSING_TYPE,
              reason: 'weekly_missing_requirement',
              cycle_id: cycle.id,
            },
            { onConflict: 'user_id,pvp_type,cycle_id,reason' },
          );
        }
      }
    }

    await supabase.from('weekly_pvp_cycles').update({ penalties_applied: true }).eq('id', cycle.id);
  }
}

export async function ensureWeeklyCycle(supabase: SupabaseClient) {
  const now = new Date();
  await finalizeExpiredCycles(supabase, now);

  const { data: active } = await supabase
    .from('weekly_pvp_cycles')
    .select('*')
    .eq('status', 'active')
    .order('start_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (active) return active;

  const { data: lastCycle } = await supabase
    .from('weekly_pvp_cycles')
    .select('end_at')
    .order('end_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const startAt = lastCycle?.end_at ? new Date(lastCycle.end_at) : now;
  return generateCycle(supabase, startAt);
}
