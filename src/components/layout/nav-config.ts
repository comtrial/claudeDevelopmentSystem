import {
  LayoutDashboard,
  Plus,
  History,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
}

export const mainNavItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true },
  { title: "New Pipeline", href: "/pipelines/new", icon: Plus },
  { title: "History", href: "/history", icon: History },
];

export const bottomNavItems: NavItem[] = [
  { title: "Settings", href: "/settings", icon: Settings },
];

export const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/pipelines/new": "New Pipeline",
  "/history": "History",
  "/settings": "Settings",
};
