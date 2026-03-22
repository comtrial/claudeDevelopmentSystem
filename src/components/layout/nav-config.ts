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
  isCta?: boolean;
}

export const mainNavItems: NavItem[] = [
  { title: "대시보드", href: "/dashboard", icon: LayoutDashboard, exact: true },
  { title: "새 파이프라인", href: "/pipelines/new", icon: Plus, isCta: true },
  { title: "히스토리", href: "/history", icon: History },
];

export const bottomNavItems: NavItem[] = [
  { title: "설정", href: "/settings", icon: Settings },
];

export const pageTitles: Record<string, string> = {
  "/dashboard": "대시보드",
  "/pipelines/new": "새 파이프라인",
  "/history": "히스토리",
  "/settings": "설정",
};
