#!/usr/bin/env node
/**
 * DEVELOPMENT ONLY — creates a demo club with a handful of players and a few weeks of
 * clearly-labelled demo results so you can click around a local Supabase.
 *
 * It refuses to run against anything other than a local Supabase unless you pass
 * --allow-remote, and every demo account uses the reserved `example.test` domain.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=... \
 *   SUPABASE_SECRET_KEY=... \
 *   node scripts/seed-demo.mjs
 *
 * Results are recorded through the same record_match function the app uses, signed in
 * as the demo players, so scoring and validation are exactly the production paths.
 */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
const allowRemote = process.argv.includes("--allow-remote");

if (!url || !publishable || !secret) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY.");
  process.exit(1);
}
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(url) && !allowRemote) {
  console.error(`Refusing to seed ${url}. This script is for local development; pass --allow-remote to override.`);
  process.exit(1);
}

const admin = createClient(url, secret, { auth: { persistSession: false } });
const PASSWORD = `demo-${randomUUID().slice(0, 8)}`;
const players = [
  ["Arjun", "arjun"],
  ["Bela", "bela"],
  ["Chirag", "chirag"],
  ["Divya", "divya"],
  ["Esha", "esha"],
  ["Farhan", "farhan"],
];

async function signedInClient(email) {
  const client = createClient(url, publishable, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

async function main() {
  const accounts = [];
  for (const [displayName, username] of players) {
    const email = `${username}@example.test`;
    const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error) throw new Error(`Could not create ${email}: ${error.message}`);
    const client = await signedInClient(email);
    const { error: profileError } = await client.from("profiles").insert({ id: data.user.id, username, display_name: displayName });
    if (profileError) throw profileError;
    accounts.push({ id: data.user.id, client, displayName });
  }

  const [host, ...rest] = accounts;
  const { data: clubId, error: clubError } = await host.client.rpc("create_club", {
    p_name: "Demo Card Room",
    p_tagline: "Demo data — safe to delete",
    p_timezone: "Asia/Kolkata",
  });
  if (clubError) throw clubError;
  const { data: invite } = await host.client.from("club_invitations").select("code").eq("club_id", clubId).single();
  for (const player of rest) {
    const { error } = await player.client.rpc("join_club", { p_code: invite.code });
    if (error) throw error;
  }

  const { data: games } = await host.client.from("game_types").select("id, slug").eq("club_id", clubId);
  const gameId = (slug) => games.find((g) => g.slug === slug).id;

  let recorded = 0;
  for (let day = 20; day >= 1; day--) {
    const table = [...accounts].sort(() => Math.random() - 0.5).slice(0, 3 + (day % 4));
    const game = day % 3 === 0 ? "poker" : day % 5 === 0 ? "teen-patti" : "bluff";
    const playedAt = new Date(Date.now() - day * 86_400_000).toISOString();
    const { error } = await host.client.rpc("record_match", {
      p_club_id: clubId,
      p_game_type_id: gameId(game),
      p_results: table.map((p, i) => ({ profile_id: p.id, placement: i + 1 })),
      p_submission_id: randomUUID(),
      p_played_at: playedAt,
      p_notes: "Demo result",
    });
    if (error) throw error;
    recorded += 1;
  }

  console.log(`Seeded "Demo Card Room" with ${accounts.length} players and ${recorded} demo matches.`);
  console.log(`Sign in as any of ${players.map(([, u]) => `${u}@example.test`).join(", ")} with password: ${PASSWORD}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
