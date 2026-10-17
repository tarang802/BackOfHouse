"use client";

import { Check, Copy, LoaderCircle, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, Select } from "@/components/ui/field";
import { createInvitationAction, revokeInvitationAction } from "@/lib/actions/club";
import { formatDate } from "@/lib/utils";

export type InvitationView = {
  id: string;
  code: string;
  expiresAt: string | null;
  maxUses: number | null;
  useCount: number;
  revokedAt: string | null;
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          window.prompt("Copy this:", value);
        }
      }}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? "Copied" : label}
    </Button>
  );
}

export function InvitePanel({ invitations, siteUrl, clubName }: { invitations: InvitationView[]; siteUrl: string; clubName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expiry, setExpiry] = useState("7");
  const [uses, setUses] = useState("");
  const active = invitations.filter(
    (i) => !i.revokedAt && (!i.expiresAt || new Date(i.expiresAt) > new Date()) && (i.maxUses === null || i.useCount < i.maxUses),
  );

  return (
    <div className="flex flex-col gap-5">
      {active.length === 0 ? <p className="text-sm text-muted">No active invitations. Create one below.</p> : null}
      <ul className="flex flex-col gap-3">
        {active.map((invite) => {
          const link = `${siteUrl}/join/${invite.code}`;
          const share = `Join ${clubName} on The Bluff Club: ${link} (code ${invite.code})`;
          return (
            <li key={invite.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-ink-2 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-2xl tracking-[0.3em] text-ivory">{invite.code}</p>
                <p className="mt-1 text-xs text-muted">
                  {invite.expiresAt ? `Expires ${formatDate(invite.expiresAt)}` : "No expiry"} ·{" "}
                  {invite.maxUses ? `${invite.useCount}/${invite.maxUses} uses` : `${invite.useCount} joined`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyButton value={link} label="Copy link" />
                <CopyButton value={share} label="Copy message" />
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Revoke invitation ${invite.code}`}
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await revokeInvitationAction(invite.id);
                      if (!result.ok) setError(result.error);
                      else router.refresh();
                    })
                  }
                >
                  <X /> Revoke
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-line p-4 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-2 text-[13px] text-ivory-dim">
          Expires after
          <Select value={expiry} onChange={(e) => setExpiry(e.target.value)}>
            <option value="1">1 day</option>
            <option value="7">7 days</option>
            <option value="30">30 days</option>
            <option value="">Never</option>
          </Select>
        </label>
        <label className="flex flex-1 flex-col gap-2 text-[13px] text-ivory-dim">
          Uses
          <Select value={uses} onChange={(e) => setUses(e.target.value)}>
            <option value="1">Single use</option>
            <option value="10">Up to 10</option>
            <option value="">Unlimited</option>
          </Select>
        </label>
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await createInvitationAction({
                expiresInDays: expiry ? Number(expiry) : null,
                maxUses: uses ? Number(uses) : null,
              });
              if (!result.ok) setError(result.error);
              else router.refresh();
            })
          }
        >
          {pending ? <LoaderCircle className="animate-spin" /> : <Plus />}
          New invitation
        </Button>
      </div>
      {error ? <FormMessage>{error}</FormMessage> : null}
    </div>
  );
}
