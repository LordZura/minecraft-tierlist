import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function toAuthEmail(username: string) {
  return `${username.trim().toLowerCase()}@mcpvp.com`;
}

export async function POST(req: Request) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Server auth env vars are missing.' }, { status: 500 });
    }

    const body = await req.json();
    const username = String(body?.username || '').trim();
    const password = String(body?.password || '');

    if (!username) {
      return NextResponse.json({ error: 'Username is required.' }, { status: 400 });
    }

    if (password.length < 4) {
      return NextResponse.json({ error: 'Password must be at least 4 characters.' }, { status: 400 });
    }

    const cleanUsername = username.toLowerCase();
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { error } = await admin.auth.admin.createUser({
      email: toAuthEmail(cleanUsername),
      password,
      email_confirm: true,
      user_metadata: { username: cleanUsername },
    });

    if (error) {
      const status = error.message.toLowerCase().includes('already') ? 409 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Could not create account.' }, { status: 500 });
  }
}
