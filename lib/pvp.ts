export const PVP_TYPES = ['crystal','sword','axe','uhc','manhunt','mace','smp','cart','bow'] as const;
export type PvpType = typeof PVP_TYPES[number];

export function isValidPvpType(value: unknown): value is PvpType {
  return typeof value === 'string' && (PVP_TYPES as readonly string[]).includes(value);
}
