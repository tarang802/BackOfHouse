"use client";

import { LogOut } from "lucide-react";
import { useTransition } from "react";
import { signOutAction } from "@/lib/actions/auth";
import { switchClubAction } from "@/lib/actions/club";

export function SignOutButton({ withLabel = false }: { withLabel?: boolean }) {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="flex h-10 items-center gap-2 rounded-full px-3 text-sm text-muted transition-colors hover:bg-white/5 hover:text-ivory"
        aria-label="Sign out"
      >
        <LogOut className="size-4" />
        {withLabel ? "Sign out" : null}
      </button>
    </form>
  );
}

export function ClubSwitcher({ clubs, activeId }: { clubs: { id: string; name: string }[]; activeId: string }) {
  const [pending, startTransition] = useTransition();
  if (clubs.length < 2) return null;
  return (
    <label className="mt-2 block">
      <span className="sr-only">Switch club</span>
      <select
        value={activeId}
        disabled={pending}
        onChange={(event) => {
          const id = event.target.value;
          startTransition(() => switchClubAction(id));
        }}
        className="h-9 w-full rounded-lg border border-line bg-ink-2 px-2 text-sm text-ivory-dim"
      >
        {clubs.map((club) => (
          <option key={club.id} value={club.id}>
            {club.name}
          </option>
        ))}
      </select>
    </label>
  );
}
