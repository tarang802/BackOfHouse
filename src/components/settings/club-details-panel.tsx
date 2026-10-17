"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/field";
import { updateClubSettingsAction } from "@/lib/actions/admin";

export function ClubDetailsPanel({
  initial,
  canEdit,
}: {
  initial: { name: string; tagline: string; playfulTitles: boolean; legendPointsThreshold: number; timezone: string };
  canEdit: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => setValues((v) => ({ ...v, [key]: value }));

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await updateClubSettingsAction(values);
          setMessage(result.ok ? { tone: "success", text: "Club settings saved." } : { tone: "error", text: result.error });
          if (result.ok) router.refresh();
        });
      }}
    >
      <fieldset disabled={!canEdit} className="flex flex-col gap-5">
        <Field label="Club name" htmlFor="c-name">
          <Input id="c-name" value={values.name} maxLength={60} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Tagline" htmlFor="c-tag">
          <Input id="c-tag" value={values.tagline} maxLength={120} onChange={(e) => set("tagline", e.target.value)} />
        </Field>
        <Field label="Time zone" htmlFor="c-tz" hint="Decides which day a late-night game counts for in seasons.">
          <Input id="c-tz" value={values.timezone} maxLength={64} onChange={(e) => set("timezone", e.target.value)} placeholder="Asia/Kolkata" />
        </Field>
        <Field label="House Legend milestone" htmlFor="c-legend" hint="Overall points needed for the House Legend achievement.">
          <Input
            id="c-legend"
            type="number"
            min={10}
            max={10000}
            value={values.legendPointsThreshold}
            onChange={(e) => set("legendPointsThreshold", Number(e.target.value))}
            className="max-w-40"
          />
        </Field>
        <label className="flex items-start gap-3 rounded-xl border border-line p-4">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-[#c7a96b]"
            checked={values.playfulTitles}
            onChange={(e) => set("playfulTitles", e.target.checked)}
          />
          <span>
            <span className="block text-sm text-ivory">Playful titles</span>
            <span className="block text-xs text-muted">
              Shows teasing achievements like “Eternal Runner-Up” and “Cursed Hand”. Off by default — only switch on if everyone is happy to
              be roasted.
            </span>
          </span>
        </label>
      </fieldset>
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}
      {canEdit ? (
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="animate-spin" /> : null}
            Save settings
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted">Only the owner and admins can change club settings.</p>
      )}
    </form>
  );
}
