import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseRouteClient";
import { getRequestUser } from "@/lib/routeAuth";
import { isValidPvpType } from '@/lib/pvp';

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const user = await getRequestUser(req);

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { challenged, pvp_type } = await req.json();

  if (!challenged || !pvp_type) {
    return NextResponse.json({ error: "Missing challenged player or PvP type." }, { status: 400 });
  }
  if (!isValidPvpType(pvp_type)) {
    return NextResponse.json({ error: 'Invalid PvP type.' }, { status: 400 });
  }
  if (challenged === user.id) return NextResponse.json({ error: "You cannot challenge yourself." }, { status: 400 });

  const { data: recent, error: recentError } = await supabase
    .from("challenges")
    .select("completed_at")
    .eq("challenger", user.id)
    .eq("challenged", challenged)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1);

  if (recentError) return NextResponse.json({ error: recentError.message }, { status: 400 });

  const lastCompleted = recent?.[0]?.completed_at;
  if (lastCompleted && new Date(lastCompleted) > new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Challenge cooldown active." }, { status: 400 });
  }

  const { data: challenge, error } = await supabase
    .from("challenges")
    .insert({ challenger: user.id, challenged, pvp_type, status: "pending" })
    .select()
    .single();

  if (error || !challenge) return NextResponse.json({ error: error?.message ?? "Failed to create challenge." }, { status: 400 });

  await supabase.from("notifications").insert({
    user_id: challenged,
    type: "challenge_request",
    related_id: challenge.id,
    message: `You have a new ${pvp_type} challenge request.`,
  });

  return NextResponse.json({ status: "ok", challenge });
}
