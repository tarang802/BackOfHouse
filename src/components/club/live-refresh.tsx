"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { readPublicEnv } from "@/lib/env";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * Narrowly scoped realtime: when a match is recorded, voided or corrected in this club,
 * or the club's activity log grows, re-render the current page from the server.
 * Realtime respects RLS, so only members receive events. Refreshes are debounced so a
 * burst of changes (a correction writes several rows) triggers a single refresh.
 */
export function LiveRefresh({ clubId }: { clubId: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!readPublicEnv()) return;
    const supabase = getSupabaseBrowserClient();
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 600);
    };
    const channel = supabase
      .channel(`club:${clubId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `club_id=eq.${clubId}` }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "audit_logs", filter: `club_id=eq.${clubId}` }, refresh)
      .subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [clubId, router]);

  return null;
}
