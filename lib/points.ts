export const POINTS = {
  FIGHT_WIN:       10,
  FIGHT_LOSS:      -5,
  CHALLENGE_WIN:   20,
  CHALLENGE_LOSS: -10,
} as const;

export function calcFightLogPoints(isWinner: boolean): number {
  return isWinner ? POINTS.FIGHT_WIN : POINTS.FIGHT_LOSS;
}

export function calcChallengePoints(isWinner: boolean): number {
  return isWinner ? POINTS.CHALLENGE_WIN : POINTS.CHALLENGE_LOSS;
}

export function winRate(wins: number, losses: number): number {
  const total = wins + losses;
  if (!total) return 0;
  return Math.round((wins / total) * 100);
}

export function formatPoints(pts: number): string {
  return pts >= 0 ? `+${pts}` : `${pts}`;
}