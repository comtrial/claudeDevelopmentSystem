"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8 min-h-[44px] min-w-[44px]"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="테마 전환"
    >
      <Sun className="size-4 rotate-0 scale-100 transition-all motion-reduce:transition-none dark:-rotate-90 dark:scale-0" strokeWidth={1.5} />
      <Moon className="absolute size-4 rotate-90 scale-0 transition-all motion-reduce:transition-none dark:rotate-0 dark:scale-100" strokeWidth={1.5} />
    </Button>
  );
}
