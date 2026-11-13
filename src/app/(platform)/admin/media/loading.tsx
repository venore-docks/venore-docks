import { Skeleton } from "@/components/ui/skeleton";

export default function MediaLoading() {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-8 w-36" />
      </div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <Skeleton className="h-12 w-full rounded-panel lg:h-72 lg:w-60 lg:shrink-0" />
        <div className="min-w-0 flex-1 space-y-4">
          <Skeleton className="h-9 w-full" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, index) => (
              <Skeleton key={index} className="aspect-[4/5] rounded-panel" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
