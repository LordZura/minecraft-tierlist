import { PVP_TYPES, type PvpType } from '@/lib/pvp';

type SB = any;

type WeeklyCycle = {
  id: string;
  start_at: string;
  end_at: string;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  selected_pvp_types: PvpType[];
  required_rounds_per_type: number;
};

type Assignment = {
  id: string;
  cycle_id: string;
  pvp_type: PvpType;
  round_number: number;
  player_a: string;
  player_b: string;
  a_ready_at: string | null;
  b_ready_at: string | null;
  ready_by_at: string | null;
  status: 'pending' | 'ready' | 'completed' | 'expired' | 'cancelled';
  winner: string | null;
  win_type: 'played' | 'default' | 'no_ready' | null;
};

type MatchupResultInput = {
  myRoundWins: number;
  opponentRoundWins: number;
};

const MS_IN_HOUR = 60 * 60 * 1000;
const MS_IN_DAY = 24 * MS_IN_HOUR;
const MS_IN_WEEK = 7 * MS_IN_DAY;
const READY_GRACE_MS = MS_IN_DAY;
const REQUIRED_TYPES = 3;
const REQUIRED_ROUNDS = 3;
const ELO_PENALTY_PER_UNPLAYED_TYPE = -12;

function nowIso() {
  return new Date().toISOString();
}

function shuffle<T>(arr: readonly T[]) {
  const clone = [...arr];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function chooseWeeklyTypes() {
  if (PVP_TYPES.length < REQUIRED_TYPES) {
    throw new Error(`Weekly event requires at least ${REQUIRED_TYPES} PvP types.`);
  }
  return shuffle(PVP_TYPES).slice(0, REQUIRED_TYPES);
}

async function createCycleNow(supabase: SB, start = new Date()) {
  const selected = chooseWeeklyTypes();
  const end = new Date(start.getTime() + MS_IN_WEEK);
  const created = await supabase
    .from('weekly_pvp_cycles')
    .insert({
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      status: 'active',
      required_rounds_per_type: REQUIRED_ROUNDS,
      selected_pvp_types: selected,
    })
    .select('*')
    .single();

  if (created.error) throw created.error;
  return created.data as WeeklyCycle;
}

function pairWeight(a: string, b: string, inCycleCount: Map<string, number>, recentCount: Map<string, number>) {
  const key = a < b ? `${a}:${b}` : `${b}:${a}`;
  const current = inCycleCount.get(key) ?? 0;
  const recent = recentCount.get(key) ?? 0;
  return current * 100 + recent;
}

function buildPairings(players: string[], inCycleCount: Map<string, number>, recentCount: Map<string, number>) {
  if (players.length < 2) return { matches: [] as [string, string][], leftover: players };

  const shuffled = shuffle(players);
  const used = new Set<string>();
  const matches: [string, string][] = [];

  for (const player of shuffled) {
    if (used.has(player)) continue;

    let bestOpponent: string | null = null;
    let bestWeight = Number.POSITIVE_INFINITY;

    for (const candidate of shuffled) {
      if (candidate === player || used.has(candidate)) continue;
      const weight = pairWeight(player, candidate, inCycleCount, recentCount);
      if (weight < bestWeight) {
        bestWeight = weight;
        bestOpponent = candidate;
      }
    }

    if (bestOpponent) {
      used.add(player);
      used.add(bestOpponent);
      matches.push([player, bestOpponent]);
      const key = player < bestOpponent ? `${player}:${bestOpponent}` : `${bestOpponent}:${player}`;
      inCycleCount.set(key, (inCycleCount.get(key) ?? 0) + 1);
    }
  }

  return { matches, leftover: shuffled.filter((id) => !used.has(id)) };
}

async function notifyUsers(
  supabase: SB,
  userIds: string[],
  type: string,
  messageBuilder: (userId: string) => string,
  relatedId?: string,
  dedupePrefix?: string,
) {
  if (userIds.length === 0) return;
  const rows = userIds.map((userId) => ({
    user_id: userId,
    type,
    related_id: relatedId ?? null,
    message: messageBuilder(userId),
    dedupe_key: dedupePrefix ? `${dedupePrefix}:${userId}` : null,
  }));
  await supabase.from('notifications').upsert(rows, { onConflict: 'user_id,dedupe_key' });
}

export async function syncWeeklyCycle(supabase: SB) {
  const now = new Date();

  await finalizeExpiredCycles(supabase, now);

  let { data: cycle } = await supabase
    .from('weekly_pvp_cycles')
    .select('*')
    .eq('status', 'active')
    .order('start_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!cycle) {
    cycle = await createCycleNow(supabase, now);

    const { data: users } = await supabase.from('users').select('id');
    const userIds = (users ?? []).map((u: any) => u.id);
    await notifyUsers(
      supabase,
      userIds,
      'weekly_cycle_started',
      () => `A new weekly PvP event started. Required types: ${cycle.selected_pvp_types.join(', ')}.`,
      cycle.id,
      `weekly_cycle_started:${cycle.id}`,
    );
  }

  await supabase
    .from('weekly_pvp_cycles')
    .update({ status: 'completed', finalized_at: now.toISOString() })
    .lt('end_at', now.toISOString())
    .neq('id', cycle.id)
    .neq('status', 'completed');

  await ensureCycleProgress(supabase, cycle);
  await ensureCycleAssignments(supabase, cycle);
  await resolveWeeklyTimeouts(supabase, cycle.id);
  await sendCycleEndingSoonAlerts(supabase, cycle);

  return cycle as WeeklyCycle;
}

async function getEligibleUserIds(supabase: SB) {
  const { data: users } = await supabase.from('users').select('id').order('created_at');
  return (users ?? []).map((u: any) => u.id as string);
}

async function ensureCycleProgress(supabase: SB, cycle: WeeklyCycle) {
  const userIds = await getEligibleUserIds(supabase);
  if (userIds.length === 0) return;

  const rows = userIds.flatMap((userId) =>
    cycle.selected_pvp_types.map((pvpType) => ({
      cycle_id: cycle.id,
      user_id: userId,
      pvp_type: pvpType,
      required_rounds: cycle.required_rounds_per_type,
      completed_rounds: 0,
    })),
  );

  await supabase.from('weekly_pvp_progress').upsert(rows, { onConflict: 'cycle_id,user_id,pvp_type' });
}

async function getRecentPairCounts(supabase: SB, cycle: WeeklyCycle) {
  const since = new Date(new Date(cycle.start_at).getTime() - MS_IN_WEEK * 4).toISOString();
  const { data } = await supabase
    .from('weekly_pvp_assignments')
    .select('player_a,player_b')
    .gte('created_at', since)
    .lt('created_at', cycle.start_at)
    .limit(5000);

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    const key = row.player_a < row.player_b ? `${row.player_a}:${row.player_b}` : `${row.player_b}:${row.player_a}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

async function ensureCycleAssignments(supabase: SB, cycle: WeeklyCycle) {
  const { data: existing } = await supabase
    .from('weekly_pvp_assignments')
    .select('id')
    .eq('cycle_id', cycle.id)
    .limit(1);
  if ((existing?.length ?? 0) > 0) return;

  const players = await getEligibleUserIds(supabase);
  if (players.length < 2) return;

  const recentCount = await getRecentPairCounts(supabase, cycle);
  const inCycleCount = new Map<string, number>();
  const insertRows: any[] = [];
  const pendingByUser = new Map<string, number>();

  for (const pvpType of cycle.selected_pvp_types) {
    for (let round = 1; round <= cycle.required_rounds_per_type; round += 1) {
      const { matches, leftover } = buildPairings(players, inCycleCount, recentCount);
      for (const [a, b] of matches) {
        insertRows.push({
          cycle_id: cycle.id,
          pvp_type: pvpType,
          round_number: round,
          player_a: a,
          player_b: b,
          status: 'pending',
        });
        pendingByUser.set(a, (pendingByUser.get(a) ?? 0) + 1);
        pendingByUser.set(b, (pendingByUser.get(b) ?? 0) + 1);
      }

      for (const byeUserId of leftover) {
        const { data: current } = await supabase
          .from('weekly_pvp_progress')
          .select('*')
          .eq('cycle_id', cycle.id)
          .eq('user_id', byeUserId)
          .eq('pvp_type', pvpType)
          .maybeSingle();

        if (!current) continue;
        const nextRounds = Math.min(current.required_rounds ?? REQUIRED_ROUNDS, (current.completed_rounds ?? 0) + 1);
        await supabase
          .from('weekly_pvp_progress')
          .update({ completed_rounds: nextRounds, completed_at: nextRounds >= (current.required_rounds ?? REQUIRED_ROUNDS) ? nowIso() : null })
          .eq('cycle_id', cycle.id)
          .eq('user_id', byeUserId)
          .eq('pvp_type', pvpType);
      }
    }
  }

  if (insertRows.length > 0) {
    await supabase.from('weekly_pvp_assignments').insert(insertRows);

    await notifyUsers(
      supabase,
      [...pendingByUser.keys()],
      'weekly_pending_assignments',
      (userId) => `You have ${pendingByUser.get(userId) ?? 0} weekly PvP matches assigned this cycle.`,
      cycle.id,
      `weekly_pending_assignments:${cycle.id}`,
    );
  }
}

async function incrementProgressForParticipants(supabase: SB, assignment: Assignment, resolvedAt: string) {
  for (const userId of [assignment.player_a, assignment.player_b]) {
    const { data: progress } = await supabase
      .from('weekly_pvp_progress')
      .select('*')
      .eq('cycle_id', assignment.cycle_id)
      .eq('user_id', userId)
      .eq('pvp_type', assignment.pvp_type)
      .maybeSingle();

    if (!progress) continue;
    const required = progress.required_rounds ?? REQUIRED_ROUNDS;
    const nextRounds = Math.min(required, (progress.completed_rounds ?? 0) + 1);

    await supabase
      .from('weekly_pvp_progress')
      .update({ completed_rounds: nextRounds, completed_at: nextRounds >= required ? resolvedAt : null })
      .eq('cycle_id', assignment.cycle_id)
      .eq('user_id', userId)
      .eq('pvp_type', assignment.pvp_type);
  }
}

async function upsertWeeklyFightLog(supabase: SB, assignment: Assignment, winnerId: string, winType: 'played' | 'default') {
  const loserId = winnerId === assignment.player_a ? assignment.player_b : assignment.player_a;
  const score = winnerId === assignment.player_a ? '1-0' : '0-1';
  const source = winType === 'default' ? 'weekly_default' : 'weekly_round';

  await supabase.from('fight_logs').upsert(
    {
      weekly_assignment_id: assignment.id,
      player1: assignment.player_a,
      player2: assignment.player_b,
      winner: winnerId,
      pvp_type: assignment.pvp_type,
      challenger_rounds_won: winnerId === assignment.player_a ? 1 : 0,
      challenged_rounds_won: winnerId === assignment.player_b ? 1 : 0,
      score,
      is_confirmed: true,
      rejected: false,
      created_by: winnerId,
      source,
    },
    { onConflict: 'weekly_assignment_id' },
  );

  await notifyUsers(
    supabase,
    [winnerId, loserId],
    'weekly_round_recorded',
    (userId) =>
      userId === winnerId
        ? `Weekly ${assignment.pvp_type}: 1 round win recorded for ranking/stat updates.`
        : `Weekly ${assignment.pvp_type}: 1 round loss recorded for ranking/stat updates.`,
    assignment.id,
    `weekly_round_recorded:${assignment.id}`,
  );
}

export function getMatchupKey(assignment: Pick<Assignment, 'pvp_type' | 'player_a' | 'player_b'>) {
  const [u1, u2] = [assignment.player_a, assignment.player_b].sort();
  return `${assignment.pvp_type}:${u1}:${u2}`;
}

async function maybeFinalizeCycleEarly(supabase: SB, cycleId: string) {
  const { data: cycle } = await supabase.from('weekly_pvp_cycles').select('status').eq('id', cycleId).maybeSingle();
  if (!cycle || cycle.status !== 'active') return;

  const { count: assignmentCount } = await supabase
    .from('weekly_pvp_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('cycle_id', cycleId);

  if ((assignmentCount ?? 0) === 0) return;

  const { count: incompleteProgressCount } = await supabase
    .from('weekly_pvp_progress')
    .select('cycle_id', { count: 'exact', head: true })
    .eq('cycle_id', cycleId)
    .filter('completed_rounds', 'lt', 'required_rounds');

  if ((incompleteProgressCount ?? 0) > 0) return;

  const { count } = await supabase
    .from('weekly_pvp_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('cycle_id', cycleId)
    .in('status', ['pending', 'ready']);

  if ((count ?? 0) > 0) return;

  await supabase
    .from('weekly_pvp_cycles')
    .update({ status: 'completed', finalized_at: nowIso() })
    .eq('id', cycleId)
    .neq('status', 'completed');
}

export async function adminResetWeeklyEventNow(supabase: SB, actorId: string, reason = 'Admin reset') {
  const now = nowIso();
  const { data: active } = await supabase
    .from('weekly_pvp_cycles')
    .select('*')
    .eq('status', 'active')
    .order('start_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (active) {
    await supabase
      .from('weekly_pvp_assignments')
      .update({ status: 'cancelled', win_type: 'admin_cancelled', resolved_at: now })
      .eq('cycle_id', active.id)
      .in('status', ['pending', 'ready']);

    await supabase
      .from('weekly_pvp_cycles')
      .update({
        status: 'cancelled',
        finalized_at: now,
        ended_by_admin: true,
        reset_by_admin_id: actorId,
        reset_reason: reason,
      })
      .eq('id', active.id)
      .eq('status', 'active');
  }

  const cycle = await createCycleNow(supabase, new Date());
  await ensureCycleProgress(supabase, cycle);
  await ensureCycleAssignments(supabase, cycle);

  const { data: users } = await supabase.from('users').select('id');
  const userIds = (users ?? []).map((u: any) => u.id as string);
  await notifyUsers(
    supabase,
    userIds,
    'weekly_cycle_started',
    () => `A new weekly PvP event started. Required types: ${cycle.selected_pvp_types.join(', ')}.`,
    cycle.id,
    `weekly_cycle_started:${cycle.id}`,
  );

  if (active) {
    const { data: impacted } = await supabase
      .from('weekly_pvp_assignments')
      .select('player_a,player_b')
      .eq('cycle_id', active.id);
    const impactedIds = [...new Set((impacted ?? []).flatMap((row: any) => [row.player_a, row.player_b]))] as string[];
    await notifyUsers(
      supabase,
      impactedIds,
      'weekly_cycle_reset',
      () => 'The previous weekly event was reset by an admin. Pending rounds were cancelled.',
      active.id,
      `weekly_cycle_reset:${active.id}`,
    );
  }

  return { oldCycleId: active?.id ?? null, newCycle: cycle };
}

export async function resolveWeeklyTimeouts(supabase: SB, cycleId: string) {
  const now = new Date();
  const nowISO = now.toISOString();
  const { data: rows } = await supabase
    .from('weekly_pvp_assignments')
    .select('*')
    .eq('cycle_id', cycleId)
    .in('status', ['pending', 'ready'])
    .order('created_at', { ascending: true });

  for (const row of (rows ?? []) as Assignment[]) {
    if (row.status === 'completed' || row.status === 'expired') continue;

    const aReady = !!row.a_ready_at;
    const bReady = !!row.b_ready_at;
    if (!aReady && !bReady) continue;
    if (aReady && bReady) continue;

    const firstReadyAt = row.a_ready_at ?? row.b_ready_at;
    if (!firstReadyAt) continue;

    const deadline = row.ready_by_at ? new Date(row.ready_by_at) : new Date(new Date(firstReadyAt).getTime() + READY_GRACE_MS);
    if (deadline.getTime() > now.getTime()) {
      if (!row.ready_by_at) {
        await supabase.from('weekly_pvp_assignments').update({ ready_by_at: deadline.toISOString() }).eq('id', row.id);
      }
      continue;
    }

    const winner = row.a_ready_at ? row.player_a : row.player_b;
    await markWeeklyMatchComplete(supabase, row.id, winner, 'default');

    const loser = winner === row.player_a ? row.player_b : row.player_a;
    await notifyUsers(
      supabase,
      [winner],
      'weekly_default_win',
      () => `Default win awarded for ${row.pvp_type} round ${row.round_number}: opponent did not confirm within 24 hours.`,
      row.id,
      `weekly_default_win:${row.id}`,
    );
    await notifyUsers(
      supabase,
      [loser],
      'weekly_missed_ready',
      () => `You missed the 24-hour ready confirmation window for ${row.pvp_type} round ${row.round_number}.`,
      row.id,
      `weekly_missed_ready:${row.id}`,
    );

    await supabase.from('weekly_pvp_assignments').update({ resolved_at: nowISO }).eq('id', row.id);
  }

  await maybeFinalizeCycleEarly(supabase, cycleId);
}

export async function markWeeklyMatchComplete(
  supabase: SB,
  assignmentId: string,
  winnerId: string,
  winType: 'played' | 'default',
) {
  const nowISO = nowIso();
  const { data: assignment } = await supabase.from('weekly_pvp_assignments').select('*').eq('id', assignmentId).single();
  if (!assignment || assignment.status === 'completed' || assignment.status === 'expired') return;
  const { data: cycle } = await supabase.from('weekly_pvp_cycles').select('id,status').eq('id', assignment.cycle_id).maybeSingle();
  if (!cycle || cycle.status !== 'active') {
    throw new Error('Weekly cycle is not active.');
  }

  if (![assignment.player_a, assignment.player_b].includes(winnerId)) {
    throw new Error('Winner must be one of the assigned players.');
  }

  const update = await supabase
    .from('weekly_pvp_assignments')
    .update({ status: 'completed', winner: winnerId, win_type: winType, resolved_at: nowISO })
    .eq('id', assignmentId)
    .in('status', ['pending', 'ready'])
    .select('*')
    .single();

  if (update.error || !update.data) return;

  await incrementProgressForParticipants(supabase, update.data as Assignment, nowISO);
  await upsertWeeklyFightLog(supabase, update.data as Assignment, winnerId, winType);
  await maybeFinalizeCycleEarly(supabase, assignment.cycle_id);
}

export async function submitWeeklyMatchupResult(
  supabase: SB,
  actorId: string,
  assignmentId: string,
  input: MatchupResultInput,
) {
  const { data: assignment } = await supabase.from('weekly_pvp_assignments').select('*').eq('id', assignmentId).single();
  if (!assignment) throw new Error('Assignment not found.');
  if (assignment.status === 'completed' || assignment.status === 'expired') throw new Error('Assignment already resolved.');
  if (assignment.status === 'cancelled') throw new Error('Assignment was cancelled.');
  if (![assignment.player_a, assignment.player_b].includes(actorId)) throw new Error('Forbidden.');
  const { data: cycle } = await supabase.from('weekly_pvp_cycles').select('id,status').eq('id', assignment.cycle_id).maybeSingle();
  if (!cycle || cycle.status !== 'active') throw new Error('Weekly cycle is no longer active.');

  const { data: rows } = await supabase
    .from('weekly_pvp_assignments')
    .select('*')
    .eq('cycle_id', assignment.cycle_id)
    .eq('pvp_type', assignment.pvp_type)
    .in('status', ['pending', 'ready']);

  const matchupRows = (rows ?? [])
    .filter((row: Assignment) => getMatchupKey(row) === getMatchupKey(assignment))
    .sort((a: Assignment, b: Assignment) => a.round_number - b.round_number);

  if (matchupRows.length === 0) throw new Error('No unresolved rounds left in this matchup.');
  if (!matchupRows.every((row: Assignment) => row.a_ready_at && row.b_ready_at)) {
    throw new Error('Both players must confirm ready first.');
  }

  const totalReported = input.myRoundWins + input.opponentRoundWins;
  if (totalReported !== matchupRows.length) {
    throw new Error(`Reported rounds (${totalReported}) must equal unresolved rounds (${matchupRows.length}).`);
  }

  const actorIsA = actorId === assignment.player_a;
  const actorWins = input.myRoundWins;
  const opponentWins = input.opponentRoundWins;

  const winnerIds = [
    ...Array.from({ length: actorWins }, () => (actorIsA ? assignment.player_a : assignment.player_b)),
    ...Array.from({ length: opponentWins }, () => (actorIsA ? assignment.player_b : assignment.player_a)),
  ];

  for (let i = 0; i < matchupRows.length; i += 1) {
    await markWeeklyMatchComplete(supabase, matchupRows[i].id, winnerIds[i], 'played');
  }

  await maybeFinalizeCycleEarly(supabase, assignment.cycle_id);
}

export async function finalizeExpiredCycles(supabase: SB, now = new Date()) {
  const nowISO = now.toISOString();
  const { data: oldCycles } = await supabase
    .from('weekly_pvp_cycles')
    .select('*')
    .lt('end_at', nowISO)
    .neq('status', 'completed');

  for (const cycle of oldCycles ?? []) {
    const { data: unresolvedAssignments } = await supabase
      .from('weekly_pvp_assignments')
      .select('*')
      .eq('cycle_id', cycle.id)
      .in('status', ['pending', 'ready']);

    for (const assignment of unresolvedAssignments ?? []) {
      await supabase
        .from('weekly_pvp_assignments')
        .update({ status: 'expired', win_type: 'no_ready', resolved_at: nowISO })
        .eq('id', assignment.id)
        .in('status', ['pending', 'ready']);
    }

    const { data: incomplete } = await supabase
      .from('weekly_pvp_progress')
      .select('*')
      .eq('cycle_id', cycle.id)
      .lt('completed_rounds', cycle.required_rounds_per_type)
      .eq('penalty_applied', false);

    for (const row of incomplete ?? []) {
      await supabase
        .from('weekly_pvp_penalties')
        .upsert(
          { cycle_id: cycle.id, user_id: row.user_id, pvp_type: row.pvp_type, elo_delta: ELO_PENALTY_PER_UNPLAYED_TYPE },
          { onConflict: 'cycle_id,user_id,pvp_type' },
        );

      await supabase
        .from('weekly_pvp_progress')
        .update({ penalty_applied: true })
        .eq('cycle_id', cycle.id)
        .eq('user_id', row.user_id)
        .eq('pvp_type', row.pvp_type);

      await notifyUsers(
        supabase,
        [row.user_id],
        'weekly_penalty_applied',
        () => `Weekly requirement failed for ${row.pvp_type}. Elo penalty ${ELO_PENALTY_PER_UNPLAYED_TYPE} applied.`,
        cycle.id,
        `weekly_penalty_applied:${cycle.id}:${row.user_id}:${row.pvp_type}`,
      );
    }

    await supabase.from('weekly_pvp_cycles').update({ status: 'completed', finalized_at: nowISO }).eq('id', cycle.id);
  }
}

async function sendCycleEndingSoonAlerts(supabase: SB, cycle: WeeklyCycle) {
  const remaining = new Date(cycle.end_at).getTime() - Date.now();
  if (remaining <= 0 || remaining > MS_IN_DAY) return;

  const { data: rows } = await supabase
    .from('weekly_pvp_progress')
    .select('user_id,pvp_type,completed_rounds,required_rounds')
    .eq('cycle_id', cycle.id);

  const byUser = new Map<string, string[]>();
  for (const row of rows ?? []) {
    if ((row.completed_rounds ?? 0) >= (row.required_rounds ?? REQUIRED_ROUNDS)) continue;
    const list = byUser.get(row.user_id) ?? [];
    list.push(`${row.pvp_type} (${row.completed_rounds}/${row.required_rounds})`);
    byUser.set(row.user_id, list);
  }

  await notifyUsers(
    supabase,
    [...byUser.keys()],
    'weekly_cycle_ending',
    (userId) => `Weekly event ends in under 24h. Incomplete: ${(byUser.get(userId) ?? []).join(', ')}.`,
    cycle.id,
    `weekly_cycle_ending:${cycle.id}`,
  );
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

export function resolveWinnerFromRounds(
  challengerId: string,
  challengedId: string,
  challengerRounds: number,
  challengedRounds: number,
) {
  return challengerRounds > challengedRounds ? challengerId : challengedId;
}
