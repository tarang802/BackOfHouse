"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/field";
import { createClubAction, joinClubAction } from "@/lib/actions/club";
import { useBrowserTimeZone } from "@/lib/hooks/client-values";
import { cn } from "@/lib/utils";

export function ClubChoice({ initialCode }: { initialCode?: string }) {
  const [tab, setTab] = useState<"create" | "join">(initialCode ? "join" : "create");
  return (
    <div>
      <div role="tablist" aria-label="Club setup" className="grid grid-cols-2 rounded-full border border-line bg-ink-2 p-1">
        {(["create", "join"] as const).map((value) => (
          <button
            key={value}
            role="tab"
            type="button"
            id={`tab-${value}`}
            aria-selected={tab === value}
            aria-controls={`panel-${value}`}
            onClick={() => setTab(value)}
            className={cn(
              "h-10 rounded-full text-sm transition-colors",
              tab === value ? "bg-surface-2 text-ivory" : "text-muted hover:text-ivory",
            )}
          >
            {value === "create" ? "Open a new club" : "Join with a code"}
          </button>
        ))}
      </div>
      <div className="mt-6" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "create" ? <CreateClubForm /> : <JoinClubForm initialCode={initialCode} />}
      </div>
    </div>
  );
}

export function CreateClubForm() {
  const [state, action, pending] = useActionState(createClubAction, null);
  const timezone = useBrowserTimeZone();
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state && !state.ok && !state.fieldErrors ? <FormMessage>{state.error}</FormMessage> : null}
      <input type="hidden" name="timezone" value={timezone} />
      <Field label="Club name" htmlFor="name" error={errors.name} hint="e.g. Room 214 Card Room">
        <Input id="name" name="name" maxLength={60} required aria-invalid={!!errors.name} />
      </Field>
      <Field label="Tagline (optional)" htmlFor="tagline" error={errors.tagline}>
        <Input id="tagline" name="tagline" maxLength={120} placeholder="Trust no one." />
      </Field>
      <p className="text-[13px] leading-relaxed text-muted">
        You become the owner. Bluff, Poker and Teen Patti are set up with the default scoring (1st +3, 2nd +1). You can change
        all of it later.
      </p>
      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" /> : null}
        Open the club
      </Button>
    </form>
  );
}

export function JoinClubForm({ initialCode }: { initialCode?: string }) {
  const [state, action, pending] = useActionState(joinClubAction, null);
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <Field label="Invitation code" htmlFor="code" error={errors.code ?? (state && !state.ok && !state.fieldErrors ? state.error : null)}>
        <Input
          id="code"
          name="code"
          defaultValue={initialCode}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={12}
          placeholder="ABCD2345"
          className="font-mono text-lg uppercase tracking-[0.3em]"
          aria-invalid={!!errors.code}
          required
        />
      </Field>
      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" /> : null}
        Join the club
      </Button>
    </form>
  );
}
