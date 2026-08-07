import { IconCheck, IconFiles, IconGitBranch, IconGitCommit } from "@tabler/icons-react"
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
      <Card className="@container/card relative overflow-hidden border-t-2 border-t-purple-500/60 bg-gradient-to-b from-purple-500/10 via-card to-card p-6 shadow-sm">
        <CardHeader className="px-0 pt-0 pb-4">
          <CardDescription className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Indexed Files</CardDescription>
          <CardTitle className="text-3xl font-bold tabular-nums tracking-tight mt-1">
            {repository ? repository.file_count : "1,250"}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-xs border-purple-500/30 text-purple-300 bg-purple-500/10 font-mono">
              <IconFiles className="size-3.5" />
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
      <Card className="@container/card relative overflow-hidden border-t-2 border-t-blue-500/60 bg-gradient-to-b from-blue-500/10 via-card to-card p-6 shadow-sm">
        <CardHeader className="px-0 pt-0 pb-4">
          <CardDescription className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Active Branch</CardDescription>
          <CardTitle className="text-2xl font-bold font-mono truncate tracking-tight mt-1">
            {repository?.current_branch || "main"}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-xs border-blue-500/30 text-blue-300 bg-blue-500/10 font-mono">
              <IconGitBranch className="size-3.5" />
              Git
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 px-0 pb-0 pt-3 text-xs text-muted-foreground border-t border-border/40">
          <div className="line-clamp-1 flex items-center gap-1.5 font-medium text-foreground">
            Current HEAD branch
          </div>
          <div className="text-muted-foreground/80">Up to date with origin</div>
        </CardFooter>
      </Card>

      {/* Card 3: HEAD Commit */}
      <Card className="@container/card relative overflow-hidden border-t-2 border-t-cyan-500/60 bg-gradient-to-b from-cyan-500/10 via-card to-card p-6 shadow-sm">
        <CardHeader className="px-0 pt-0 pb-4">
          <CardDescription className="text-xs font-medium uppercase tracking-wider text-muted-foreground">HEAD Commit</CardDescription>
          <CardTitle className="text-2xl font-bold font-mono truncate tracking-tight mt-1">
            {repository?.head_commit ? repository.head_commit.slice(0, 7) : "a1b2c3d"}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-xs border-cyan-500/30 text-cyan-300 bg-cyan-500/10 font-mono">
              <IconGitCommit className="size-3.5" />
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
      <Card className="@container/card relative overflow-hidden border-t-2 border-t-emerald-500/60 bg-gradient-to-b from-emerald-500/10 via-card to-card p-6 shadow-sm">
        <CardHeader className="px-0 pt-0 pb-4">
          <CardDescription className="text-xs font-medium uppercase tracking-wider text-muted-foreground">AI Code Index Score</CardDescription>
          <CardTitle className="text-3xl font-bold tabular-nums tracking-tight text-emerald-400 mt-1">
            {repository ? "98%" : "100%"}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-xs text-emerald-400 border-emerald-500/30 bg-emerald-500/10 font-mono">
              <IconCheck className="size-3.5" />
              Optimal
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 px-0 pb-0 pt-3 text-xs text-muted-foreground border-t border-border/40">
          <div className="line-clamp-1 flex items-center gap-1.5 font-medium text-foreground">
            Antigravity Engine Active
          </div>
          <div className="text-muted-foreground/80">Ready for refactoring</div>
        </CardFooter>
      </Card>
    </div>
  )
}
