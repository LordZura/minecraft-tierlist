import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabaseRouteClient';
import { getRequestUser } from '@/lib/routeAuth';
import { validateChallengeRoundScore } from '@/lib/scoreValidation';

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { challenge_id, challenger_round_wins, challenged_round_wins } = await req.json();
  if (!challenge_id) return NextResponse.json({ error: 'Missing challenge_id.' }, { status: 400 });

  let parsed;
  try {
    parsed = validateChallengeRoundScore(challenger_round_wins, challenged_round_wins);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data: challenge } = await supabase.from('challenges').select('*').eq('id', challenge_id).single();
  if (!challenge) return NextResponse.json({ error: 'Challenge not found.' }, { status: 404 });
  if (challenge.status !== 'accepted') return NextResponse.json({ error: 'Challenge is not active.' }, { status: 400 });
  if (challenge.challenger !== user.id && challenge.challenged !== user.id) return NextResponse.json({ error: 'Not your challenge.' }, { status: 403 });

  const totalRoundsAlready = (challenge.challenger_wins ?? 0) + (challenge.challenged_wins ?? 0);
  const roundsToAdd = parsed.challengerRounds + parsed.challengedRounds;
  if (totalRoundsAlready >= 10) return NextResponse.json({ error: 'Challenge already completed.' }, { status: 400 });
  if (totalRoundsAlready + roundsToAdd > 10) {
    return NextResponse.json({ error: 'Submitted rounds exceed 10-round series limit.' }, { status: 400 });
  }

  const { count: matchCount } = await supabase
    .from('challenge_matches')
    .select('id', { count: 'exact', head: true })
    .eq('challenge_id', challenge_id);

  if ((matchCount ?? 0) >= 10) {
    return NextResponse.json({ error: 'All 10 match entries already logged.' }, { status: 400 });
  }

  const matchNumber = (matchCount ?? 0) + 1;
  const winner_id = parsed.winnerSide === 'challenger' ? challenge.challenger : challenge.challenged;

  await supabase.from('challenge_matches').insert({
    challenge_id,
    match_number: matchNumber,
    winner: winner_id,
    pvp_type: challenge.pvp_type,
    challenger_round_wins: parsed.challengerRounds,
    challenged_round_wins: parsed.challengedRounds,
    score: `${parsed.challengerRounds}-${parsed.challengedRounds}`,
  });

  const cWins = challenge.challenger_wins + parsed.challengerRounds;
  const dWins = challenge.challenged_wins + parsed.challengedRounds;

  await supabase.from('challenges').update({ challenger_wins: cWins, challenged_wins: dWins }).eq('id', challenge_id);

  const seriesWinner = cWins >= 6 ? challenge.challenger : dWins >= 6 ? challenge.challenged : null;
  const allPlayed = cWins + dWins >= 10;

  if (seriesWinner || allPlayed) {
    const finalWinner = seriesWinner ?? (cWins > dWins ? challenge.challenger : challenge.challenged);
    await supabase.from('challenges').update({
      status: 'completed',
      winner: finalWinner,
      completed_at: new Date().toISOString(),
    }).eq('id', challenge_id);

    const loser = finalWinner === challenge.challenger ? challenge.challenged : challenge.challenger;
    await supabase.from('notifications').insert([
      { user_id: finalWinner, type: 'challenge_result', related_id: challenge_id, message: `You won the ${challenge.pvp_type} challenge series! Rankings updated.` },
      { user_id: loser, type: 'challenge_result', related_id: challenge_id, message: `Challenge series ended. You lost in ${challenge.pvp_type}.` },
    ]);
  }

  return NextResponse.json({ status: 'ok', matchNumber });
}
