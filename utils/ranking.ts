export function calcFightLogPoints(isConfirmed: boolean): number {
  return isConfirmed ? 10 : 0;
}

export function calcFightLogPointsLoser(isConfirmed: boolean): number {
  return isConfirmed ? -5 : 0;
}

export function calcChallengeWinPoints(won: boolean): number {
  return won ? 20 : 0;
}

export function calcChallengeLosePoints(won: boolean): number {
  return won ? 0 : -10;
}