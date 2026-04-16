import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseRouteClient";
import { getRequestUser } from "@/lib/routeAuth";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { challenge_id, winner_id, pvp_type, score } = await req.json();
  if (!challenge_id || !winner_id || !pvp_type) {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }

  const { data: challenge } = await supabase
    .from("challenges")
    .select("*")
    .eq("id", challenge_id)
    .single();

  if (!challenge) return NextResponse.json({ error: "Challenge not found." }, { status: 404 });
  if (challenge.status !== "accepted") return NextResponse.json({ error: "Challenge is not active." }, { status: 400 });
  if (challenge.challenger !== user.id && challenge.challenged !== user.id) {
    return NextResponse.json({ error: "Not your challenge." }, { status: 403 });
  }
  if (winner_id !== challenge.challenger && winner_id !== challenge.challenged) {
    return NextResponse.json({ error: "Winner must be a participant." }, { status: 400 });
  }

  // Get current match count
  const { count: matchCount } = await supabase
    .from("challenge_matches")
    .select("id", { count: "exact", head: true })
    .eq("challenge_id", challenge_id);

  if ((matchCount ?? 0) >= 10) {
    return NextResponse.json({ error: "All 10 matches already logged." }, { status: 400 });
  }

  const matchNumber = (matchCount ?? 0) + 1;

  await supabase.from("challenge_matches").insert({
    challenge_id,
    match_number: matchNumber,
    winner: winner_id,
    pvp_type,
    score: typeof score === "string" ? score.trim() || null : null,
  });

  // Update win counts
  const isChallenger = winner_id === challenge.challenger;
  const updateField = isChallenger ? "challenger_wins" : "challenged_wins";
  const newCount = (isChallenger ? challenge.challenger_wins : challenge.challenged_wins) + 1;

  const updatedChallenge = await supabase
    .from("challenges")
    .update({ [updateField]: newCount })
    .eq("id", challenge_id)
    .select()
    .single();

  // Check if series is over (6 wins = majority of 10, or all 10 played)
  const cWins = isChallenger ? newCount : challenge.challenger_wins;
  const dWins = isChallenger ? challenge.challenged_wins : newCount;
  const seriesWinner = cWins >= 6 ? challenge.challenger : dWins >= 6 ? challenge.challenged : null;
  const allPlayed = matchNumber >= 10;

  if (seriesWinner || allPlayed) {
    const finalWinner = seriesWinner ?? (cWins > dWins ? challenge.challenger : challenge.challenged);
    await supabase.from("challenges").update({
      status: "completed",
      winner: finalWinner,
      completed_at: new Date().toISOString(),
    }).eq("id", challenge_id);

    // Notify both players
    const loser = finalWinner === challenge.challenger ? challenge.challenged : challenge.challenger;
    await supabase.from("notifications").insert([
      { user_id: finalWinner, type: "challenge_result", related_id: challenge_id, message: "You won the challenge series! Rankings updated." },
      { user_id: loser, type: "challenge_result", related_id: challenge_id, message: "Challenge series ended. You lost. 3-day cooldown applied." },
    ]);
  }

  return NextResponse.json({ status: "ok", matchNumber, total: matchCount });
}
