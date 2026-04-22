import type { EloState } from '@/utils/elo';
import { PVP_TYPES, type PvpType } from '@/lib/pvp';

type EloAdjustmentRow = {
  user_id: string;
  pvp_type: PvpType;
  delta: number;
};

export function applyEloAdjustments(base: Record<string, EloState>, adjustments: EloAdjustmentRow[]) {
  const out = { ...base };

  adjustments.forEach((adj) => {
    const player = out[adj.user_id];
    if (!player) return;
    if (!PVP_TYPES.includes(adj.pvp_type)) return;
    player.byType[adj.pvp_type] += adj.delta;
  });

  Object.values(out).forEach((player) => {
    player.average = Math.round(PVP_TYPES.reduce((acc, t) => acc + player.byType[t], 0) / PVP_TYPES.length);
    player.overall = player.average;
    PVP_TYPES.forEach((t) => {
      player.byType[t] = Math.round(player.byType[t]);
    });
  });

  return out;
}
