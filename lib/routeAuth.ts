import type { NextRequest } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabaseRouteClient';

export async function getRequestUser(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return null;

  const supabase = await createSupabaseRouteClient();
  const { data } = await supabase
    .from('users')
    .select('id, username')
    .eq('id', userId)
    .single();

  return data ? { ...data, is_admin: data.username === "admin" } : null;
}
