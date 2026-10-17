import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { ClubChoice } from "@/components/onboarding/club-forms";
import { ProfileForm } from "@/components/onboarding/profile-form";
import { getMyClubs, getMyProfile, requireUser } from "@/lib/data/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Welcome" };

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  await requireUser("/onboarding");
  const params = await searchParams;
  const code = typeof params.code === "string" ? params.code : undefined;
  const profile = await getMyProfile();
  const clubs = profile ? await getMyClubs() : [];
  if (profile && clubs.length > 0 && !code) redirect("/club");
  const step = profile ? 2 : 1;

  return (
    <div className="felt min-h-dvh px-4 py-6 sm:px-10">
      <Logo />
      <main id="main" className="mx-auto max-w-md py-10">
        <ol className="mb-10 flex items-center gap-3" aria-label="Setup progress">
          {["Player card", "Your club"].map((label, index) => (
            <li key={label} className="flex flex-1 items-center gap-3" aria-current={step === index + 1 ? "step" : undefined}>
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs",
                  step > index + 1 ? "border-felt-bright bg-felt text-ivory" : step === index + 1 ? "border-gold text-gold" : "border-line text-faint",
                )}
              >
                {step > index + 1 ? "✓" : index + 1}
              </span>
              <span className={cn("text-sm", step === index + 1 ? "text-ivory" : "text-muted")}>{label}</span>
              {index === 0 ? <span className="h-px flex-1 bg-line" /> : null}
            </li>
          ))}
        </ol>

        {step === 1 ? (
          <>
            <h1 className="font-display text-[2.6rem] leading-none text-ivory">Your player card.</h1>
            <p className="mt-3 text-[15px] text-muted">This is how you appear on leaderboards. No email is ever shown.</p>
            <div className="mt-8">
              <ProfileForm mode="create" inviteCode={code} />
            </div>
          </>
        ) : (
          <>
            <h1 className="font-display text-[2.6rem] leading-none text-ivory">Find your table.</h1>
            <p className="mt-3 text-[15px] text-muted">
              Open a club for your group, or join one with the code a friend shared.
            </p>
            <div className="mt-8">
              <ClubChoice initialCode={code} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
