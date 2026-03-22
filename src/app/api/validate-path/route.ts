import { NextRequest, NextResponse } from "next/server";
import { existsSync, statSync, readdirSync } from "fs";
import { basename, join } from "path";
import { successResponse } from "@/lib/api/response";

// Base directory for all projects — localhost-only, no auth required
const BASE_DIR = "/Users/choeseung-won/personal-project";

/** POST — validate a single path */
export async function POST(req: NextRequest) {
  try {
    const { path } = await req.json();

    if (!path || typeof path !== "string") {
      return NextResponse.json(
        successResponse({ exists: false, name: "", reason: "invalid_input" })
      );
    }

    const trimmed = path.trim();

    if (!trimmed.startsWith("/")) {
      return NextResponse.json(
        successResponse({ exists: false, name: "", reason: "absolute_path_required" })
      );
    }

    if (!existsSync(trimmed)) {
      return NextResponse.json(
        successResponse({ exists: false, name: "", reason: "not_found" })
      );
    }

    const stat = statSync(trimmed);
    if (!stat.isDirectory()) {
      return NextResponse.json(
        successResponse({ exists: false, name: "", reason: "not_directory" })
      );
    }

    // Check for project indicators
    const hasPackageJson = existsSync(join(trimmed, "package.json"));
    const hasClaudeMd = existsSync(join(trimmed, "CLAUDE.md"));
    const hasGit = existsSync(join(trimmed, ".git"));

    return NextResponse.json(
      successResponse({
        exists: true,
        name: basename(trimmed),
        reason: null,
        indicators: { hasPackageJson, hasClaudeMd, hasGit },
      })
    );
  } catch {
    return NextResponse.json(
      successResponse({ exists: false, name: "", reason: "error" })
    );
  }
}

/** GET — list project directories under BASE_DIR */
export async function GET() {
  try {
    const entries = readdirSync(BASE_DIR, { withFileTypes: true });

    const projects = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => {
        const fullPath = join(BASE_DIR, e.name);
        const hasPackageJson = existsSync(join(fullPath, "package.json"));
        const hasClaudeMd = existsSync(join(fullPath, "CLAUDE.md"));
        const hasGit = existsSync(join(fullPath, ".git"));
        return {
          name: e.name,
          path: fullPath,
          indicators: { hasPackageJson, hasClaudeMd, hasGit },
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(successResponse({ baseDir: BASE_DIR, projects }));
  } catch {
    return NextResponse.json(
      successResponse({ baseDir: BASE_DIR, projects: [] })
    );
  }
}
