"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { NavItem } from "./nav-config";

interface SidebarNavItemProps {
  item: NavItem;
  collapsed: boolean;
  onClick?: () => void;
}

export function SidebarNavItem({ item, collapsed, onClick }: SidebarNavItemProps) {
  const pathname = usePathname();
  const isActive = item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = item.icon;

  const link = (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "hover:bg-accent/50 hover:text-accent-foreground",
        isActive && "bg-accent text-accent-foreground font-medium",
        !isActive && "text-muted-foreground",
        item.isCta && !isActive && "text-primary font-medium hover:bg-primary/10",
        collapsed && "justify-center px-2"
      )}
    >
      <Icon className="size-5 shrink-0" strokeWidth={1.5} />
      {!collapsed && <span>{item.title}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{item.title}</TooltipContent>
      </Tooltip>
    );
  }

  return link;
}
