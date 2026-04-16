import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSupabaseRouteClient } from "@/lib/supabaseRouteClient";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const username = String(body?.username || "")
      .trim()
      .toLowerCase();
    const password = String(body?.password || "");

    if (!username) {
      return NextResponse.json(
        { error: "Username is required." },
        { status: 400 },
      );
    }

    if (username.length < 3) {
      return NextResponse.json(
        { error: "Username must be at least 3 characters." },
        { status: 400 },
      );
    }

    if (!/^[a-z0-9_]+$/.test(username)) {
      return NextResponse.json(
        {
          error:
            "Username can only contain lowercase letters, numbers, and underscores.",
        },
        { status: 400 },
      );
    }

    if (password.length < 4) {
      return NextResponse.json(
        { error: "Password must be at least 4 characters." },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseRouteClient();

    const { data: existing, error: existingError } = await supabase
      .from("users")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        { error: existingError.message },
        { status: 400 },
      );
    }

    if (existing) {
      return NextResponse.json(
        { error: "That username is already taken." },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const { data: inserted, error: insertError } = await supabase
      .from("users")
      .insert({
        username,
        password_hash: passwordHash,
        is_admin: false,
      })
      .select("id, username, is_admin")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      user: inserted,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Could not create account." },
      { status: 500 },
    );
  }
}
