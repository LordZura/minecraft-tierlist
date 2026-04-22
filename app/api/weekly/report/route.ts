import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabaseRouteClient';
import { getRequestUser } from '@/lib/routeAuth';
import { submitWeeklyMatchupResult, validateRounds } from '@/lib/weekly';

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { assignment_id, my_round_wins, opponent_round_wins } = await req.json();
  if (!assignment_id) return NextResponse.json({ error: 'Missing assignment_id' }, { status: 400 });

  const rounds = validateRounds(my_round_wins, opponent_round_wins);
  if ('error' in rounds) return NextResponse.json({ error: rounds.error }, { status: 400 });

  try {
    await submitWeeklyMatchupResult(supabase, user.id, assignment_id, {
      myRoundWins: rounds.challengerRounds,
      opponentRoundWins: rounds.challengedRounds,
    });
    return NextResponse.json({ status: 'ok' });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Failed to submit matchup result.' }, { status: 400 });
  }
}
