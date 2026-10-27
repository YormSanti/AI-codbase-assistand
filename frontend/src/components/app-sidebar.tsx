import {
  BarChart3,
  Bot,
  Code2,
  Folder,
  GitBranch,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  SquareTerminal,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { RepositoryInfo } from "@/types/domain";
import { ProjectsSidebarNav } from "@/components/ProjectsSidebarNav";

export function AppSidebar({
  activeTab = "dashboard",
  onSelectTab,
  repository,
  onOpenRepository,
  onOpenTerminal,
  onDeleteRepository,
  onSelectThread,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
  repository?: RepositoryInfo | null;
  onOpenRepository?: (path: string) => Promise<void> | void;
  onOpenTerminal?: (path: string) => Promise<void> | void;
  onDeleteRepository?: (repositoryId: number) => Promise<void> | void;
  onSelectThread?: (threadId: string) => void;
}) {
  const navItems = [
    { title: "Dashboard", id: "dashboard", icon: LayoutDashboard },
    { title: "File Explorer", id: "explorer", icon: Folder },
    { title: "Terminal", id: "terminal", icon: SquareTerminal },
    { title: "Git Repository", id: "git", icon: GitBranch },
    { title: "AI Assistant", id: "ai", icon: Bot },
    { title: "Analytics", id: "analytics", icon: BarChart3 },
    { title: "Code Health", id: "health", icon: ShieldCheck },
  ];

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden">
                <img src="/logo.png" alt="IFROG Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">IFROG</span>
                <span className="truncate text-xs text-muted-foreground">
                  {repository ? repository.name : "Intelligence Platform"}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="p-2 flex flex-col gap-2 overflow-y-auto">
        <SidebarMenu>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  isActive={isActive}
                  onClick={() => onSelectTab?.(item.id)}
                  tooltip={item.title}
                >
                  <Icon className="size-4" />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>

        {/* ── Projects Tree & Threads Section (Visible when expanded) ──── */}
        <div className="group-data-[collapsible=icon]:hidden mt-2 pt-2 border-t border-sidebar-border">
          <ProjectsSidebarNav
            currentRepository={repository}
            onOpenRepository={onOpenRepository}
            onOpenTerminal={onOpenTerminal}
            onDeleteRepository={onDeleteRepository}
            onSelectThread={onSelectThread}
            onSelectTab={onSelectTab}
          />
        </div>
      </SidebarContent>

      <SidebarFooter className="p-2 border-t border-sidebar-border text-xs text-muted-foreground flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={activeTab === "editor"}
              onClick={() => onSelectTab?.("editor")}
              tooltip="Code Editor"
            >
              <Code2 className="size-4" />
              <span>Code Editor</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={activeTab === "settings"}
              onClick={() => onSelectTab?.("settings")}
              tooltip="Settings"
            >
              <Settings className="size-4" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="px-2 py-1 truncate font-mono">
          {repository ? `Branch: ${repository.current_branch || "main"}` : "No repo connected"}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
