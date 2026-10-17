import { Skeleton } from "@/components/ui/feedback";

export default function ClubLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-12 w-2/3 max-w-md" />
      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
      <Skeleton className="h-48" />
    </div>
  );
}
