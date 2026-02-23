"use client";

import { Music } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { mainNavItems, bottomNavItems } from "./nav-config";
import { SidebarNavItem } from "./sidebar-nav-item";
import { UserMenu } from "./user-menu";

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
}

export function MobileNav({ open, onClose }: MobileNavProps) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="left" className="w-60 p-0" showCloseButton={false}>
        <SheetHeader className="flex h-14 items-center border-b border-border px-4">
          <div className="flex items-center gap-2">
            <Music className="size-5 shrink-0 text-primary" strokeWidth={1.5} />
            <SheetTitle className="text-sm font-semibold tracking-tight">
              Sequeliquance
            </SheetTitle>
          </div>
        </SheetHeader>
        <nav aria-label="모바일 네비게이션" className="flex-1 space-y-1 p-2">
          {mainNavItems.map((item) => (
            <SidebarNavItem
              key={item.href}
              item={item}
              collapsed={false}
              onClick={onClose}
            />
          ))}
        </nav>
        <Separator />
        <div className="space-y-1 p-2">
          {bottomNavItems.map((item) => (
            <SidebarNavItem
              key={item.href}
              item={item}
              collapsed={false}
              onClick={onClose}
            />
          ))}
          <UserMenu collapsed={false} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
