import { NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabaseRouteClient';
import { syncWeeklyCycle } from '@/lib/weekly';

export async function POST() {
  const supabase = await createSupabaseRouteClient();
  try {
    const cycle = await syncWeeklyCycle(supabase);
    return NextResponse.json({ status: 'ok', cycle });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Failed to sync weekly cycle.' }, { status: 500 });
  }
}
