"use client";

import { ArrowLeftRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/field";

export function RivalryPicker({
  players,
  a,
  b,
}: {
  players: { username: string; displayName: string }[];
  a: string;
  b: string;
}) {
  const router = useRouter();
  const go = (nextA: string, nextB: string) => router.push(`/club/rivalries?a=${encodeURIComponent(nextA)}&b=${encodeURIComponent(nextB)}`);
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
      <label className="flex flex-col gap-2">
        <span className="text-[13px] text-ivory-dim">Player</span>
        <Select value={a} onChange={(e) => go(e.target.value, b)}>
          {players.map((p) => (
            <option key={p.username} value={p.username} disabled={p.username === b}>
              {p.displayName}
            </option>
          ))}
        </Select>
      </label>
      <button
        type="button"
        onClick={() => go(b, a)}
        className="mb-1 flex size-10 items-center justify-center rounded-full border border-line text-muted hover:text-ivory"
        aria-label="Swap players"
      >
        <ArrowLeftRight className="size-4" />
      </button>
      <label className="flex flex-col gap-2">
        <span className="text-[13px] text-ivory-dim">Opponent</span>
        <Select value={b} onChange={(e) => go(a, e.target.value)}>
          {players.map((p) => (
            <option key={p.username} value={p.username} disabled={p.username === a}>
              {p.displayName}
            </option>
          ))}
        </Select>
      </label>
    </div>
  );
}
