import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createSupabaseRouteClient } from '@/lib/supabaseRouteClient';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const username = String(body?.username || '').trim().toLowerCase();
    const password = String(body?.password || '');

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 });
    }

    const supabase = await createSupabaseRouteClient();

    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, password_hash, is_admin')
      .eq('username', username)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!user) {
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        is_admin: user.is_admin,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Could not log in.' },
      { status: 500 }
    );
  }
}