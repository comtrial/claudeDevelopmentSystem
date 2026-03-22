import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { successResponse, handleError } from "@/lib/api/response";
import { AppError, Errors } from "@/lib/api/errors";
import { getPageContent } from "@/lib/notion/client";

type Params = { params: Promise<{ id: string }> };

// UUID format: 32 hex chars with optional dashes
const PAGE_ID_PATTERN = /^[a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12}$/i;

// GET /api/notion/pages/[id] - Get a specific page's content as markdown
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await getAuthenticatedUser();

    const { id } = await params;

    // Validate page ID format
    if (!PAGE_ID_PATTERN.test(id)) {
      throw Errors.badRequest("유효하지 않은 페이지 ID 형식입니다.");
    }

    const token = process.env.NOTION_TOKEN;
    if (!token) {
      throw new AppError(
        503,
        "Notion 연동이 설정되지 않았습니다. NOTION_TOKEN을 확인해주세요.",
        "NOTION_NOT_CONFIGURED"
      );
    }

    const content = await getPageContent(id);

    return NextResponse.json(successResponse(content));
  } catch (err) {
    const { body, status } = handleError(err);
    return NextResponse.json(body, { status });
  }
}
