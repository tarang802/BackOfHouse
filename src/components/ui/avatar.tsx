import { cn, initials } from "@/lib/utils";
import { isSuit, SuitIcon } from "./suit";

const sizes = {
  xs: "size-7 text-[10px]",
  sm: "size-9 text-xs",
  md: "size-11 text-sm",
  lg: "size-16 text-lg",
  xl: "size-24 text-2xl",
};

/**
 * Player emblem: an uploaded photo, or a monogram on a card-like tile with the
 * player's chosen suit tucked into the corner.
 */
export function Avatar({
  name,
  src,
  emblem = "spade",
  size = "md",
  ring,
  className,
}: {
  name: string;
  src?: string | null;
  emblem?: string;
  size?: keyof typeof sizes;
  ring?: "gold" | "felt";
  className?: string;
}) {
  const suit = isSuit(emblem) ? emblem : "spade";
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border bg-gradient-to-b from-surface-2 to-ink-2 font-display font-semibold text-ivory",
        ring === "gold" ? "border-gold/70" : ring === "felt" ? "border-felt-bright/70" : "border-line-strong",
        sizes[size],
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- user uploads from Supabase storage
        <img src={src} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <>
          <span aria-hidden className="tracking-wide">
            {initials(name)}
          </span>
          <SuitIcon suit={suit} className="absolute bottom-[14%] right-[16%] size-[22%] text-gold/70" />
        </>
      )}
      <span className="sr-only">{name}</span>
    </span>
  );
}
