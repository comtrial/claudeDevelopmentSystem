"use client";

import { PanelLeftClose, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { mainNavItems, bottomNavItems } from "./nav-config";
import { SidebarNavItem } from "./sidebar-nav-item";
import { UserMenu } from "./user-menu";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={cn(
        "hidden h-screen flex-shrink-0 flex-col border-r border-border bg-background transition-[width] duration-200 ease-in-out md:flex",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo / Brand */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        {!collapsed && (
          <span className="text-lg font-semibold tracking-tight">
            AgentOS
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className={cn("h-8 w-8 shrink-0", collapsed ? "mx-auto" : "ml-auto")}
        >
          {collapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {mainNavItems.map((item) => (
          <SidebarNavItem key={item.href} item={item} collapsed={collapsed} />
        ))}
      </nav>

      <Separator />

      {/* Bottom: Settings + User */}
      <div className="space-y-1 p-2">
        {bottomNavItems.map((item) => (
          <SidebarNavItem key={item.href} item={item} collapsed={collapsed} />
        ))}
        <UserMenu collapsed={collapsed} />
      </div>
    </aside>
  );
}
