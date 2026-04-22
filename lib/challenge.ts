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
