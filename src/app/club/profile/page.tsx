import type { Metadata } from "next";
import { AvatarUploader } from "@/components/club/avatar-uploader";
import { ProfileForm } from "@/components/onboarding/profile-form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/feedback";
import { requireClub } from "@/lib/data/session";

export const metadata: Metadata = { title: "Your profile" };

export default async function EditProfilePage() {
  const { profile } = await requireClub();
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Player card" title="Your profile" description="How you appear to everyone in your clubs." />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader title="Photo" />
          <CardBody>
            <AvatarUploader userId={profile.id} displayName={profile.displayName} emblem={profile.emblem} avatarUrl={profile.avatarUrl} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Details" />
          <CardBody>
            <ProfileForm
              mode="edit"
              initial={{ username: profile.username, displayName: profile.displayName, emblem: profile.emblem, avatarUrl: profile.avatarUrl }}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
