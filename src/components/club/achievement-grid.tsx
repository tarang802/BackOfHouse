import { Lock } from "lucide-react";
import { SuitIcon } from "@/components/ui/suit";
import type { AchievementStatus } from "@/lib/domain/achievements";
import { cn } from "@/lib/utils";

export function AchievementGrid({ achievements }: { achievements: AchievementStatus[] }) {
  const earned = achievements.filter((a) => a.earned).length;
  return (
    <div>
      <p className="mb-4 text-sm text-muted">
        {earned} of {achievements.length} earned
      </p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {achievements.map((a) => (
          <li
            key={a.id}
            className={cn(
              "relative flex flex-col gap-3 rounded-2xl border p-4",
              a.earned ? "border-gold/40 bg-gradient-to-b from-gold/[0.06] to-transparent" : "border-line opacity-80",
            )}
          >
            <span
              className={cn(
                "flex h-12 w-9 items-center justify-center rounded-md border",
                a.earned ? "border-gold/60 text-gold" : "border-line-strong text-faint",
              )}
            >
              {a.earned ? <SuitIcon suit={a.suit} className="size-4" /> : <Lock className="size-3.5" aria-hidden />}
            </span>
            <div>
              <p className={cn("text-sm font-semibold", a.earned ? "text-ivory" : "text-ivory-dim")}>
                {a.name}
                <span className="sr-only">{a.earned ? " (earned)" : " (locked)"}</span>
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{a.description}</p>
            </div>
            {!a.earned ? <p className="mt-auto text-[11px] uppercase tracking-wider text-faint">{a.progress}</p> : null}
            {a.playful ? <span className="absolute right-3 top-3 text-[10px] uppercase tracking-wider text-faint">For fun</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
