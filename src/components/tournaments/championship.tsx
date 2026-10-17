"use client";

import { Avatar } from "@/components/ui/avatar";
import { SuitIcon, type Suit } from "@/components/ui/suit";
import { useReducedMotion } from "@/lib/hooks/client-values";

const SUITS: Suit[] = ["spade", "heart", "diamond", "club"];

/**
 * Championship reveal: a slow rise of the champion's card with a few drifting suits.
 * Falls back to a static presentation when the user prefers reduced motion.
 */
export function Championship({
  tournamentName,
  champion,
  detail,
}: {
  tournamentName: string;
  champion: { displayName: string; avatarUrl: string | null; emblem: string };
  detail: string;
}) {
  const motion = !useReducedMotion();

  return (
    <section
      aria-label="Tournament champion"
      className="relative overflow-hidden rounded-[2rem] border border-gold/40 bg-[radial-gradient(90%_70%_at_50%_0%,rgb(199_169_107/0.14),transparent_60%),linear-gradient(to_bottom,#141613,#0b0c0b)] px-6 py-14 text-center sm:py-20"
    >
      {motion
        ? Array.from({ length: 14 }, (_, i) => (
            <SuitIcon
              key={i}
              suit={SUITS[i % 4]}
              aria-hidden
              className="pointer-events-none absolute size-3 text-gold/30"
              style={{
                left: `${(i * 37) % 100}%`,
                top: "-10%",
                animation: `champion-fall ${7 + (i % 5)}s linear ${i * 0.45}s infinite`,
              }}
            />
          ))
        : null}
      <style>{`@keyframes champion-fall { from { transform: translateY(0) rotate(0deg); opacity: 0 } 10% { opacity: 1 } to { transform: translateY(560px) rotate(200deg); opacity: 0 } }`}</style>
      <div className="relative mx-auto flex max-w-md flex-col items-center gap-5 animate-rise">
        <p className="eyebrow text-gold/90">Champion</p>
        <div className="relative">
          <span className="absolute -inset-3 rounded-full border border-gold/30" aria-hidden />
          <Avatar name={champion.displayName} src={champion.avatarUrl} emblem={champion.emblem} size="xl" ring="gold" />
        </div>
        <h2 className="font-display text-5xl leading-none text-ivory sm:text-6xl">{champion.displayName}</h2>
        <div className="hairline-gold w-40" aria-hidden />
        <p className="font-display text-xl italic text-gold">{tournamentName}</p>
        <p className="text-sm text-muted">{detail}</p>
      </div>
    </section>
  );
}
