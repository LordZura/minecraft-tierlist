import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseRouteClient";
import { getRequestUser } from "@/lib/routeAuth";

const VALID_PVP_TYPES = ["crystal", "sword", "axe", "uhc", "manhunt", "mace", "smp", "cart", "bow"] as const;

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const user = await getRequestUser(req);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { player2, pvp_type, winner, score } = await req.json();

  if (!player2 || !pvp_type || !winner) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  if (player2 === user.id) {
    return NextResponse.json({ error: "You cannot fight yourself." }, { status: 400 });
  }

  if (!VALID_PVP_TYPES.includes(pvp_type)) {
    return NextResponse.json({ error: "Invalid PvP type." }, { status: 400 });
  }

  if (winner !== user.id && winner !== player2) {
    return NextResponse.json({ error: "Winner must be either player1 or player2." }, { status: 400 });
  }

  const { data: opponent, error: opponentError } = await supabase.from("users").select("id").eq("id", player2).single();

  if (opponentError || !opponent) {
    return NextResponse.json({ error: "Opponent not found." }, { status: 400 });
  }

  const { data: log, error } = await supabase
    .from("fight_logs")
    .insert({ player1: user.id, player2, winner, pvp_type, score, is_confirmed: false, created_by: user.id })
    .select()
    .single();

  if (error || !log) {
    return NextResponse.json({ error: error?.message ?? "Failed to create fight log." }, { status: 400 });
  }

  const { error: notifError } = await supabase.from("notifications").insert({
    user_id: player2,
    type: "fight_log_request",
    related_id: log.id,
    message: "Fight log needs your confirmation.",
  });

  if (notifError) {
    return NextResponse.json({ error: notifError.message }, { status: 400 });
  }

  return NextResponse.json({ status: "ok", log });
}
