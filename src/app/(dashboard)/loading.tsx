import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24">
      <Skeleton className="size-12 rounded-full" />
      <div className="flex flex-col items-center gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-5 w-72" />
        <Skeleton className="h-5 w-64" />
      </div>
      <Skeleton className="h-10 w-full max-w-xs" />
      <div className="grid w-full max-w-lg grid-cols-1 gap-4 sm:grid-cols-3">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
    </div>
  );
}
