import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseRouteClient";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { fight_log_id } = await req.json();
  if (!fight_log_id) return NextResponse.json({ error: "Missing fight_log_id." }, { status: 400 });

  const { data: log } = await supabase
    .from("fight_logs")
    .select("*")
    .eq("id", fight_log_id)
    .single();

  if (!log) return NextResponse.json({ error: "Fight log not found." }, { status: 404 });
  if (log.is_confirmed || log.rejected) return NextResponse.json({ error: "Already actioned." }, { status: 400 });
  if (log.created_by === user.id) return NextResponse.json({ error: "Cannot reject your own log." }, { status: 403 });
  if (log.player1 !== user.id && log.player2 !== user.id) return NextResponse.json({ error: "Not your fight." }, { status: 403 });

  await supabase.from("fight_logs").update({ rejected: true }).eq("id", fight_log_id);

  await supabase.from("notifications").insert({
    user_id: log.created_by,
    type: "fight_log_rejected",
    related_id: fight_log_id,
    message: "Your fight log was rejected by the opponent.",
  });

  return NextResponse.json({ status: "ok" });
}