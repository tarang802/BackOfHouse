"use client";

import { LogOut } from "lucide-react";
import { signOutAction } from "@/lib/actions/auth";

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
