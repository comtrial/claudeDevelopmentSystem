import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { successResponse, handleError } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { listChildPages } from "@/lib/notion/client";

// GET /api/notion/pages - List child pages of the root Notion page
export async function GET() {
  try {
    await getAuthenticatedUser();

    const token = process.env.NOTION_TOKEN;
    if (!token) {
      throw new AppError(
        503,
        "Notion 연동이 설정되지 않았습니다. NOTION_TOKEN을 확인해주세요.",
        "NOTION_NOT_CONFIGURED"
      );
    }

    const rootPageId = process.env.NOTION_ROOT_PAGE_ID;
    if (!rootPageId) {
      throw new AppError(
        503,
        "Notion 루트 페이지가 설정되지 않았습니다. NOTION_ROOT_PAGE_ID를 확인해주세요.",
        "NOTION_ROOT_NOT_CONFIGURED"
      );
    }

    const pages = await listChildPages(rootPageId);

    return NextResponse.json(
      successResponse({
        pages,
        root_page_id: rootPageId,
        root_page_title: "Claude Dev System",
      })
    );
  } catch (err) {
    const { body, status } = handleError(err);
    return NextResponse.json(body, { status });
  }
}
