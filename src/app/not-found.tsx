import { PlayingCard } from "@/components/brand/playing-card";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="felt flex min-h-dvh flex-col items-center justify-center gap-8 px-4 text-center">
      <PlayingCard rank="?" suit="club" className="w-28 -rotate-6" />
      <div>
        <p className="eyebrow">404</p>
        <h1 className="mt-3 font-display text-5xl text-ivory">That card isn&apos;t in the deck.</h1>
        <p className="mx-auto mt-3 max-w-sm text-muted">
          The page does not exist, or it belongs to a club you are not a member of.
        </p>
      </div>
      <ButtonLink href="/club">Back to the club</ButtonLink>
    </main>
  );
}
