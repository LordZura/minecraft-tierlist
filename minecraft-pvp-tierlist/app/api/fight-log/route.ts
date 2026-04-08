import { supabase } from '@/lib/supabaseClient';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { player2, pvp_type, winner, score } = await req.json();
  const user = await supabase.auth.getUser(); // attach session!

  // Validation: Only registered users, no self-matches
  // Only allow if valid PvP type
  // Winner must be player1 or player2

  const { data, error } = await supabase
    .from('fight_logs')
    .insert({
      player1: user.id,
      player2,
      winner,
      pvp_type,
      score,
      is_confirmed: false,
      created_by: user.id
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Notification for player2
  await supabase.from('notifications').insert({
    user_id: player2,
    type: 'fight_log_request',
    related_id: data[0].id,
    message: `Fight log needs your confirmation.`,
  });

  return NextResponse.json({ status: 'ok', log: data[0] });
}