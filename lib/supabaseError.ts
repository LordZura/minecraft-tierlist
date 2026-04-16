export function getSupabaseFriendlyError(error: unknown, fallbackMessage: string): string {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (/failed to fetch/i.test(message)) {
    return "Cannot reach Supabase right now. Check NEXT_PUBLIC_SUPABASE_URL and confirm your Supabase project is active.";
  }

  if (/name[_ ]not[_ ]resolved/i.test(message)) {
    return "Supabase hostname could not be resolved. Verify NEXT_PUBLIC_SUPABASE_URL points to a valid *.supabase.co project URL.";
  }

  return message || fallbackMessage;
}
