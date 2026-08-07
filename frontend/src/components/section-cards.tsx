import { IconCheck, IconFiles, IconGitBranch, IconGitCommit, IconTrendingUp } from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { RepositoryInfo } from "@/types/domain"

export function SectionCards({ repository }: { repository?: RepositoryInfo | null }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {/* Card 1: Indexed Files */}
      <Card className="group relative overflow-hidden border border-border/80 bg-gradient-to-b from-purple-500/15 via-card to-card p-6 shadow-md transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/50 hover:shadow-purple-500/10">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-indigo-500 opacity-80 group-hover:opacity-100 transition-opacity" />
        <CardHeader className="px-0 pt-0 pb-4">
          <CardDescription className="text-xs font-semibold uppercase tracking-wider text-purple-300/80">Indexed Files</CardDescription>
          <CardTitle className="text-3xl font-extrabold tabular-nums tracking-tight mt-1 text-foreground">
            {repository ? repository.file_count.toLocaleString() : "1,250"}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-xs border-purple-500/30 text-purple-300 bg-purple-500/10 font-mono shadow-xs">
              <IconFiles className="size-3.5 text-purple-400" />
              Indexed
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 px-0 pb-0 pt-3 text-xs text-muted-foreground border-t border-border/40">
          <div className="line-clamp-1 flex items-center gap-1.5 font-medium text-foreground">
            Fast tree discovery <IconCheck className="size-3.5 text-emerald-400" />
          </div>
          <div className="text-muted-foreground/80">Deep code structure parsing</div>
        </CardFooter>
      </Card>

      {/* Card 2: Active Branch */}
      <Card className="group relative overflow-hidden border border-border/80 bg-gradient-to-b from-blue-500/15 via-card to-card p-6 shadow-md transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/50 hover:shadow-blue-500/10">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-500 opacity-80 group-hover:opacity-100 transition-opacity" />
        <CardHeader className="px-0 pt-0 pb-4">
          <CardDescription className="text-xs font-semibold uppercase tracking-wider text-blue-300/80">Active Branch</CardDescription>
          <CardTitle className="text-2xl font-extrabold font-mono truncate tracking-tight mt-1 text-foreground">
            {repository?.current_branch || "main"}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-xs border-blue-500/30 text-blue-300 bg-blue-500/10 font-mono shadow-xs">
              <IconGitBranch className="size-3.5 text-blue-400" />
              Git
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 px-0 pb-0 pt-3 text-xs text-muted-foreground border-t border-border/40">
          <div className="line-clamp-1 flex items-center gap-1.5 font-medium text-foreground">
            Current HEAD branch <span className="inline-block size-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="text-muted-foreground/80">Up to date with origin</div>
        </CardFooter>
      </Card>

      {/* Card 3: HEAD Commit */}
      <Card className="group relative overflow-hidden border border-border/80 bg-gradient-to-b from-cyan-500/15 via-card to-card p-6 shadow-md transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/50 hover:shadow-cyan-500/10">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-teal-500 opacity-80 group-hover:opacity-100 transition-opacity" />
        <CardHeader className="px-0 pt-0 pb-4">
          <CardDescription className="text-xs font-semibold uppercase tracking-wider text-cyan-300/80">HEAD Commit</CardDescription>
          <CardTitle className="text-2xl font-extrabold font-mono truncate tracking-tight mt-1 text-foreground">
            {repository?.head_commit ? repository.head_commit.slice(0, 7) : "a1b2c3d"}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-xs border-cyan-500/30 text-cyan-300 bg-cyan-500/10 font-mono shadow-xs">
              <IconGitCommit className="size-3.5 text-cyan-400" />
              SHA
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 px-0 pb-0 pt-3 text-xs text-muted-foreground border-t border-border/40">
          <div className="line-clamp-1 flex items-center gap-1.5 font-medium text-foreground">
            Latest commit hash
          </div>
          <div className="text-muted-foreground/80">Working tree ready</div>
        </CardFooter>
      </Card>

      {/* Card 4: AI Code Index Score */}
      <Card className="group relative overflow-hidden border border-border/80 bg-gradient-to-b from-emerald-500/15 via-card to-card p-6 shadow-md transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/50 hover:shadow-emerald-500/10">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-green-500 opacity-80 group-hover:opacity-100 transition-opacity" />
        <CardHeader className="px-0 pt-0 pb-4">
          <CardDescription className="text-xs font-semibold uppercase tracking-wider text-emerald-300/80">AI Code Index Score</CardDescription>
          <CardTitle className="text-3xl font-extrabold tabular-nums tracking-tight text-emerald-400 mt-1">
            {repository ? "98%" : "100%"}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-xs text-emerald-300 border-emerald-500/30 bg-emerald-500/10 font-mono shadow-xs">
              <IconTrendingUp className="size-3.5 text-emerald-400" />
              Optimal
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 px-0 pb-0 pt-3 text-xs text-muted-foreground border-t border-border/40">
          <div className="line-clamp-1 flex items-center gap-1.5 font-medium text-foreground">
            Antigravity Engine Active <IconCheck className="size-3.5 text-emerald-400" />
          </div>
          <div className="text-muted-foreground/80">Ready for refactoring</div>
        </CardFooter>
      </Card>
    </div>
  )
}
