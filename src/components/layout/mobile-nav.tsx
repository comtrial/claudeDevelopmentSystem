"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { navItems } from "./nav-config";
import { NavLink } from "./nav-link";

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
}

export function MobileNav({ open, onClose }: MobileNavProps) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="flex h-14 items-center border-b border-border px-4">
          <SheetTitle className="text-lg font-semibold tracking-tight">
            AgentOS
          </SheetTitle>
        </SheetHeader>
        <nav className="space-y-1 p-2">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              collapsed={false}
              onClick={onClose}
            />
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
