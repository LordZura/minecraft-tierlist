export type RoundScore = {
  challengerRounds: number;
  challengedRounds: number;
  winnerSide: 'challenger' | 'challenged';
};

export function parseRoundWins(input: unknown): number {
  const n = Number(input);
  if (!Number.isInteger(n) || n < 0 || n > 10) {
    throw new Error('Round wins must be a whole number between 0 and 10.');
  }
  return n;
}

export function validateChallengeRoundScore(challengerRounds: unknown, challengedRounds: unknown): RoundScore {
  const cr = parseRoundWins(challengerRounds);
  const dr = parseRoundWins(challengedRounds);

  if (cr === dr) throw new Error('Challenge submissions cannot be ties.');
  if (cr === 0 && dr === 0) throw new Error('At least one round must be won.');

  return {
    challengerRounds: cr,
    challengedRounds: dr,
    winnerSide: cr > dr ? 'challenger' : 'challenged',
  };
}
