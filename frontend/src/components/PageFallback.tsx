import { LoaderCircle } from "lucide-react";

// Shown while a lazily loaded page chunk is being fetched.
export function PageFallback({ label = "Loading view" }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex min-h-40 flex-1 items-center justify-center p-10 text-muted-foreground">
      <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
    </div>
  );
}
