import { Skeleton, SkeletonList } from "@/components/ui/feedback";

// Shown at once when switching tabs while the page's data streams in.
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-10">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-28 w-full rounded-lg" />
      <SkeletonList rows={3} label="Loading" />
    </div>
  );
}
