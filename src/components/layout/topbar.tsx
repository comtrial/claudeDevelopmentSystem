"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "./theme-toggle";
import { pageTitles } from "./nav-config";

interface TopbarProps {
  onMenuClick: () => void;
}

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];

  if (pathname.match(/^\/pipelines\/[^/]+\/monitor$/)) return "파이프라인 모니터";
  if (pathname.match(/^\/pipelines\/[^/]+\/review$/)) return "코드 리뷰";
  if (pathname.match(/^\/history\/[^/]+$/)) return "히스토리 상세";

  return "대시보드";
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header
      className="sticky top-0 z-[100] flex shrink-0 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      style={{ height: "var(--topbar-height)" }}
    >
      <Button
        variant="ghost"
        size="icon"
        className="size-8 min-h-[44px] min-w-[44px] md:hidden"
        onClick={onMenuClick}
        aria-label="메뉴 열기"
      >
        <Menu className="size-4" strokeWidth={1.5} />
      </Button>

      <Separator orientation="vertical" className="h-6 md:hidden" />

      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>

      <div className="flex-1" />

      <ThemeToggle />
    </header>
  );
}
