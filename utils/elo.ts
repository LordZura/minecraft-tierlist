export const PVP_TYPES = ['crystal','sword','axe','uhc','manhunt','mace','smp','cart','bow'] as const;
export type PvpType = typeof PVP_TYPES[number];

export type EloEvent = {
  playerA: string;
  playerB: string;
  winner: string;
  pvp_type: PvpType;
  created_at: string;
};

export type EloState = {
  overall: number;
  average: number;
  byType: Record<PvpType, number>;
};

const START_ELO = 1000;
const K = 24;

function expectedScore(rA: number, rB: number) {
  return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}

export function computeElo(userIds: string[], events: EloEvent[]): Record<string, EloState> {
  const state: Record<string, EloState> = {};

  userIds.forEach((id) => {
    state[id] = {
      overall: START_ELO,
      average: START_ELO,
      byType: Object.fromEntries(PVP_TYPES.map((t) => [t, START_ELO])) as Record<PvpType, number>,
    };
  });

  const sorted = [...events].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));

  for (const e of sorted) {
    const a = state[e.playerA];
    const b = state[e.playerB];
    if (!a || !b) continue;

    const aWon = e.winner === e.playerA;

    const expA = expectedScore(a.overall, b.overall);
    const deltaA = K * ((aWon ? 1 : 0) - expA);
    a.overall += deltaA;
    b.overall -= deltaA;

    const ra = a.byType[e.pvp_type];
    const rb = b.byType[e.pvp_type];
    const expTypeA = expectedScore(ra, rb);
    const deltaTypeA = K * ((aWon ? 1 : 0) - expTypeA);
    a.byType[e.pvp_type] += deltaTypeA;
    b.byType[e.pvp_type] -= deltaTypeA;
  }

  userIds.forEach((id) => {
    const avg = PVP_TYPES.reduce((acc, t) => acc + state[id].byType[t], 0) / PVP_TYPES.length;
    state[id].average = avg;

    state[id].overall = Math.round(state[id].overall);
    state[id].average = Math.round(state[id].average);
    PVP_TYPES.forEach((t) => {
      state[id].byType[t] = Math.round(state[id].byType[t]);
    });
  });

  return state;
}
