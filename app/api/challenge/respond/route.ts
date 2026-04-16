import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseRouteClient";
import { getRequestUser } from "@/lib/routeAuth";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { challenge_id, action } = await req.json();
  if (!challenge_id || !["accept", "reject"].includes(action)) {
    return NextResponse.json({ error: "Missing or invalid parameters." }, { status: 400 });
  }

  const { data: challenge } = await supabase.from("challenges").select("*").eq("id", challenge_id).single();
  if (!challenge) return NextResponse.json({ error: "Challenge not found." }, { status: 404 });
  if (challenge.challenged !== user.id) return NextResponse.json({ error: "Not your challenge." }, { status: 403 });
  if (challenge.status !== "pending") return NextResponse.json({ error: "Challenge already actioned." }, { status: 400 });

  const newStatus = action === "accept" ? "accepted" : "rejected";
  await supabase.from("challenges").update({ status: newStatus }).eq("id", challenge_id);

  await supabase.from("notifications").insert({
    user_id: challenge.challenger,
    type: "challenge_result",
    related_id: challenge_id,
    message: action === "accept" ? "Your challenge was accepted! Time to play." : "Your challenge was declined.",
  });

  return NextResponse.json({ status: "ok" });
}
