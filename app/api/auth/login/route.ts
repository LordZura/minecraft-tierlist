import { NextResponse } from 'next/server';
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
      .select('id, username')
      .eq('username', username)
      .eq('password', password)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!user) {
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
    }

    return NextResponse.json({ ok: true, user: { ...user, is_admin: user.username === "admin" } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Could not log in.' }, { status: 500 });
  }
}
