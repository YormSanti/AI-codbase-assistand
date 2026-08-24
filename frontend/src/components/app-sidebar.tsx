import * as React from "react"
import {
  IconChartBar,
  IconDashboard,
  IconFolder,
  IconGitBranch,
  IconRobot,
  IconSettings,
  IconTerminal2,
} from "@tabler/icons-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import type { RepositoryInfo } from "@/types/domain"

export function AppSidebar({
  activeTab = "dashboard",
  onSelectTab,
  repository,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
  repository?: RepositoryInfo | null;
}) {
  const navItems = [
    { title: "Dashboard", id: "dashboard", icon: IconDashboard },
    { title: "File Explorer", id: "explorer", icon: IconFolder },
    { title: "Terminal", id: "terminal", icon: IconTerminal2 },
    { title: "Git Repository", id: "git", icon: IconGitBranch },
    { title: "AI Assistant", id: "ai", icon: IconRobot },
    { title: "Analytics", id: "analytics", icon: IconChartBar },
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
                <img src="/logo.png" alt="IFROG Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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

      <SidebarContent className="p-2">
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
      </SidebarContent>

      <SidebarFooter className="p-2 border-t border-sidebar-border text-xs text-muted-foreground flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={activeTab === "settings"}
              onClick={() => onSelectTab?.("settings")}
              tooltip="Settings"
            >
              <IconSettings className="size-4" />
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
