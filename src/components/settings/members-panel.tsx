"use client";

import { Crown, LoaderCircle, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage } from "@/components/ui/field";
import { removeMemberAction, setMemberRoleAction, transferOwnershipAction } from "@/lib/actions/admin";
import { leaveClubAction } from "@/lib/actions/club";
import type { ActionResult } from "@/lib/errors";

type Member = { profileId: string; displayName: string; username: string; avatarUrl: string | null; emblem: string; role: "owner" | "admin" | "member" };

export function MembersPanel({ members, myId, myRole }: { members: Member[]; myId: string; myRole: "owner" | "admin" | "member" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | { kind: "remove" | "transfer"; member: Member }>(null);

  const run = (fn: () => Promise<ActionResult>) =>
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (!result.ok) setError(result.error);
      else {
        setConfirm(null);
        router.refresh();
      }
    });

  const canRemove = (m: Member) => m.profileId !== myId && m.role !== "owner" && (myRole === "owner" || (myRole === "admin" && m.role === "member"));

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-line">
        {members.map((m) => (
          <li key={m.profileId} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar name={m.displayName} src={m.avatarUrl} emblem={m.emblem} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm text-ivory">
                  {m.displayName} {m.profileId === myId ? <span className="text-xs text-muted">(you)</span> : null}
                </p>
                <p className="truncate text-xs text-muted">@{m.username}</p>
              </div>
              <Badge tone={m.role === "owner" ? "gold" : m.role === "admin" ? "ivory" : "neutral"}>{m.role}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {myRole === "owner" && m.role !== "owner" ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => run(() => setMemberRoleAction({ profileId: m.profileId, role: m.role === "admin" ? "member" : "admin" }))}
                  >
                    {m.role === "admin" ? "Make member" : "Make admin"}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirm({ kind: "transfer", member: m })}>
                    <Crown /> Transfer ownership
                  </Button>
                </>
              ) : null}
              {canRemove(m) ? (
                <Button size="sm" variant="danger" disabled={pending} onClick={() => setConfirm({ kind: "remove", member: m })}>
                  Remove
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {error && !confirm ? <FormMessage>{error}</FormMessage> : null}

      {myRole !== "owner" ? (
        <div className="border-t border-line pt-4">
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => leaveClubAction())}>
            <LogOut /> Leave this club
          </Button>
        </div>
      ) : null}

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm?.kind === "transfer" ? `Make ${confirm.member.displayName} the owner?` : `Remove ${confirm?.member.displayName}?`}
        description={
          confirm?.kind === "transfer"
            ? "You will become an admin. Only the owner can change scoring and roles."
            : "Their past results stay in the history, but they lose access to the club."
        }
      >
        {error ? <FormMessage>{error}</FormMessage> : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(null)}>
            Cancel
          </Button>
          <Button
            variant={confirm?.kind === "transfer" ? "gold" : "danger"}
            disabled={pending}
            onClick={() =>
              confirm && run(() => (confirm.kind === "transfer" ? transferOwnershipAction(confirm.member.profileId) : removeMemberAction(confirm.member.profileId)))
            }
          >
            {pending ? <LoaderCircle className="animate-spin" /> : null}
            {confirm?.kind === "transfer" ? "Transfer" : "Remove"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
