import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LedgerEntry = { matchId: string; profileId: string; buyIn: number; cashOut: number };

/** Private, optional poker session accounting for this club (members only, via RLS). */
export const getPokerLedger = cache(async (clubId: string): Promise<LedgerEntry[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("poker_ledger_entries")
    .select("match_id, profile_id, buy_in, cash_out")
    .eq("club_id", clubId);
  if (error) throw new Error("Could not load session accounting.");
  return (data ?? []).map((row) => ({
    matchId: row.match_id as string,
    profileId: row.profile_id as string,
    buyIn: Number(row.buy_in),
    cashOut: Number(row.cash_out),
  }));
});
