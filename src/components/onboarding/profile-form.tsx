"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/field";
import { SUITS, SuitIcon, type Suit } from "@/components/ui/suit";
import { createProfileAction, updateProfileAction } from "@/lib/actions/profile";
import { suggestUsername } from "@/lib/validation/profile";
import { cn } from "@/lib/utils";

export function ProfileForm({
  mode,
  initial,
  inviteCode,
}: {
  mode: "create" | "edit";
  inviteCode?: string;
  initial?: { username: string; displayName: string; emblem: string; avatarUrl?: string | null };
}) {
  const [state, action, pending] = useActionState(mode === "create" ? createProfileAction : updateProfileAction, null);
  const [displayName, setDisplayName] = useState(initial?.displayName ?? "");
  const [username, setUsername] = useState(initial?.username ?? "");
  const [usernameTouched, setUsernameTouched] = useState(mode === "edit");
  const [emblem, setEmblem] = useState<Suit>((initial?.emblem as Suit) ?? "spade");
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      {inviteCode ? <input type="hidden" name="code" value={inviteCode} /> : null}
      <div className="flex items-center gap-4 rounded-2xl border border-line bg-ink-2 p-4">
        <Avatar name={displayName || "?"} src={initial?.avatarUrl} emblem={emblem} size="lg" ring="gold" />
        <div className="min-w-0">
          <p className="truncate font-display text-2xl text-ivory">{displayName || "Your name"}</p>
          <p className="truncate text-sm text-muted">@{username || "username"}</p>
        </div>
      </div>

      {state && !state.ok && !state.fieldErrors ? <FormMessage>{state.error}</FormMessage> : null}
      {state?.ok ? <FormMessage tone="success">Profile saved.</FormMessage> : null}

      <Field label="Display name" htmlFor="displayName" error={errors.displayName} hint="What your friends call you at the table.">
        <Input
          id="displayName"
          name="displayName"
          autoComplete="nickname"
          maxLength={40}
          value={displayName}
          aria-invalid={!!errors.displayName}
          onChange={(e) => {
            setDisplayName(e.target.value);
            if (!usernameTouched) setUsername(suggestUsername(e.target.value));
          }}
          required
        />
      </Field>

      <Field label="Username" htmlFor="username" error={errors.username} hint="Lowercase letters, numbers and _ · used in your profile link.">
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint">@</span>
          <Input
            id="username"
            name="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={20}
            className="pl-8"
            value={username}
            aria-invalid={!!errors.username}
            onChange={(e) => {
              setUsernameTouched(true);
              setUsername(e.target.value.toLowerCase());
            }}
            required
          />
        </div>
      </Field>

      <fieldset>
        <legend className="text-[13px] font-medium text-ivory-dim">Your emblem</legend>
        <input type="hidden" name="emblem" value={emblem} />
        <div className="mt-2 grid grid-cols-4 gap-2">
          {SUITS.map((suit) => (
            <button
              key={suit}
              type="button"
              aria-pressed={emblem === suit}
              aria-label={suit}
              onClick={() => setEmblem(suit)}
              className={cn(
                "flex h-14 items-center justify-center rounded-xl border transition-colors",
                emblem === suit ? "border-gold/70 bg-gold/10 text-gold" : "border-line text-faint hover:text-ivory",
              )}
            >
              <SuitIcon suit={suit} className="size-5" />
            </button>
          ))}
        </div>
      </fieldset>

      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" /> : null}
        {mode === "create" ? "Create my player card" : "Save changes"}
      </Button>
    </form>
  );
}
