/**
 * Public configuration. Only NEXT_PUBLIC_* values live here — they are safe in the
 * browser because Row Level Security protects the data. No privileged key is ever read
 * by the web app.
 */

export type PublicEnv = {
  supabaseUrl: string;
  supabaseKey: string;
  siteUrl: string;
};

export function readPublicEnv(): PublicEnv | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return {
    supabaseUrl,
    supabaseKey,
    siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  };
}

export function requirePublicEnv(): PublicEnv {
  const env = readPublicEnv();
  if (!env) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return env;
}

export function isSupabaseConfigured(): boolean {
  return readPublicEnv() !== null;
}
