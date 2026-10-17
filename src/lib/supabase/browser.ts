"use client";

import { createBrowserClient } from "@supabase/ssr";
import { requirePublicEnv } from "@/lib/env";

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Browser client — publishable key only. Used for avatar uploads and live refreshes. */
export function getSupabaseBrowserClient() {
  if (!client) {
    const env = requirePublicEnv();
    client = createBrowserClient(env.supabaseUrl, env.supabaseKey);
  }
  return client;
}
