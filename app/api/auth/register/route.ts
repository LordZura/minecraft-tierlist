import { NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabaseRouteClient';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const username = String(body?.username || '').trim().toLowerCase();
    const password = String(body?.password || '');

    if (!username) {
      return NextResponse.json({ error: 'Username is required.' }, { status: 400 });
    }

    if (password.length < 4) {
      return NextResponse.json({ error: 'Password must be at least 4 characters.' }, { status: 400 });
    }

    const supabase = await createSupabaseRouteClient();

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .ilike('username', username)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'That username is already taken.' }, { status: 409 });
    }

    const userId = crypto.randomUUID();
    const { error } = await supabase.from('users').insert({
      id: userId,
      username,
      password,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      user: { id: userId, username, is_admin: username === 'admin' },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Could not create account.' }, { status: 500 });
  }
}
