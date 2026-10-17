"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ClubError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-4 rounded-[var(--radius-card)] border border-loss/30 bg-loss-deep/20 p-6">
      <p className="eyebrow">Misdeal</p>
      <h1 className="font-display text-3xl text-ivory">This page could not load.</h1>
      <p className="max-w-lg text-sm text-muted">
        It may be a connection problem. Your recorded results are safe. {error.digest ? `Reference: ${error.digest}` : ""}
      </p>
      <Button onClick={reset} variant="outline">
        <RotateCcw /> Try again
      </Button>
    </div>
  );
}
