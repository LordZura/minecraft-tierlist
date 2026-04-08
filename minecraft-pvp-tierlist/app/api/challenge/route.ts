import { supabase } from '@/lib/supabaseClient';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { challenged } = await req.json();
  const user = await supabase.auth.getUser();

  // Check cooldown: SELECT for last 'completed' challenge
  const { data: recent } = await supabase
    .from('challenges')
    .select('completed_at')
    .eq('challenger', user.id)
    .eq('challenged', challenged)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1);

  if (recent && recent[0] && new Date(recent[0].completed_at) > new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Challenge cooldown active.' }, { status: 400 });
  }

  // Create challenge
  const { data, error } = await supabase
    .from('challenges')
    .insert({
      challenger: user.id,
      challenged,
      status: 'pending'
    })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from('notifications').insert({
    user_id: challenged,
    type: 'challenge_request',
    related_id: data[0].id,
    message: `You have a new challenge request.`,
  });

  return NextResponse.json({ status: 'ok', challenge: data[0] });
}