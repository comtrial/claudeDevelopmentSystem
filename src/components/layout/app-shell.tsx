"use client";

import { useSidebar } from "@/hooks/use-sidebar";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { MobileNav } from "./mobile-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { collapsed, toggle, mobileOpen, openMobile, closeMobile } =
    useSidebar();

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <MobileNav open={mobileOpen} onClose={closeMobile} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar onMenuClick={openMobile} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
