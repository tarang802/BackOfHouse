import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

/** In-club 404: keeps the club navigation around the message. */
export default function ClubNotFound() {
  return (
    <EmptyState
      suit="club"
      title="Not in this club"
      action={<ButtonLink href="/club" size="sm">Back to the dashboard</ButtonLink>}
    >
      That player, match or tournament does not exist here — or it belongs to a club you are not a member of.
    </EmptyState>
  );
}
