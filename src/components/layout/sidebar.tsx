"use client";

import { PanelLeftClose, PanelLeft, Music } from "lucide-react";
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
        "hidden h-screen flex-shrink-0 flex-col border-r border-border bg-background transition-[width] duration-200 ease-in-out motion-reduce:transition-none md:flex",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div
        className="flex items-center gap-2 border-b border-border px-4"
        style={{ height: "var(--topbar-height)" }}
      >
        {!collapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
            <Music className="size-5 shrink-0 text-primary" strokeWidth={1.5} />
            <span className="truncate text-sm font-semibold tracking-tight">
              Sequeliquance
            </span>
          </div>
        )}
        {collapsed && (
          <Music className="mx-auto size-5 shrink-0 text-primary" strokeWidth={1.5} />
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
          className={cn("size-8 shrink-0", collapsed ? "hidden" : "ml-auto")}
        >
          <PanelLeftClose className="size-4" strokeWidth={1.5} />
        </Button>
      </div>

      {collapsed && (
        <div className="flex justify-center py-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            aria-label="사이드바 펼치기"
            className="size-8"
          >
            <PanelLeft className="size-4" strokeWidth={1.5} />
          </Button>
        </div>
      )}

      <nav aria-label="주 네비게이션" className="flex-1 space-y-1 p-2">
        {mainNavItems.map((item) => (
          <SidebarNavItem key={item.href} item={item} collapsed={collapsed} />
        ))}
      </nav>

      <Separator />

      <nav aria-label="보조 네비게이션" className="space-y-1 p-2">
        {bottomNavItems.map((item) => (
          <SidebarNavItem key={item.href} item={item} collapsed={collapsed} />
        ))}
        <UserMenu collapsed={collapsed} />
      </nav>
    </aside>
  );
}
