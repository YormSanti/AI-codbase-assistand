import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/ThemeToggle"
import { CheckCircle2, Circle } from "lucide-react"

export function SiteHeader({
  hasRepository = false,
  currentView = "Dashboard",
}: {
  hasRepository?: boolean;
  currentView?: string;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 lg:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4"
        />
        <h1 className="text-sm font-semibold capitalize">{currentView}</h1>
      </div>

      <div className="flex items-center gap-3">
        <Badge variant={hasRepository ? "default" : "outline"} className="gap-1.5 py-1 text-xs">
          {hasRepository ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>Repo Connected</span>
            </>
          ) : (
            <>
              <Circle className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Ready</span>
            </>
          )}
        </Badge>
        <ThemeToggle />
      </div>
    </header>
  )
}
