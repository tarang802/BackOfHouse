import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readPublicEnv } from "@/lib/env";

/**
 * Supabase client bound to the signed-in user's session cookies. Every query made with
 * it runs as that user, so Row Level Security always applies.
 */
export async function createSupabaseServerClient() {
  // Read cookies first: it marks the route as request-time rendered.
  const cookieStore = await cookies();
  const env = readPublicEnv();
  if (!env) redirect("/setup");
  return createServerClient(env.supabaseUrl, env.supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only. The proxy
          // refreshes the session on the next request, so this is safe to ignore.
        }
      },
    },
  });
}
