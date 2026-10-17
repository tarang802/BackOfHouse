"use client";

import { RotateCcw } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="felt flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <p className="eyebrow">Misdeal</p>
      <h1 className="font-display text-5xl text-ivory">Something went wrong.</h1>
      <p className="max-w-md text-muted">
        The page could not be loaded. Nothing you saved has been lost. Try again, or head back to the club.
      </p>
      {error.digest ? <p className="font-mono text-xs text-faint">Reference: {error.digest}</p> : null}
      <div className="flex gap-3">
        <Button onClick={reset}>
          <RotateCcw /> Try again
        </Button>
        <ButtonLink href="/club" variant="outline">
          Club home
        </ButtonLink>
      </div>
    </main>
  );
}
