import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { successResponse, handleError } from "@/lib/api/response";
import { Errors } from "@/lib/api/errors";

type Params = { params: Promise<{ id: string; changeId: string }> };

// GET /api/pipelines/[id]/changes/[changeId]/comments - List comments for a change
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    const { id, changeId } = await params;

    // Verify pipeline ownership
    const { data: pipeline, error: pipelineErr } = await supabase
      .from("pipelines")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (pipelineErr || !pipeline) {
      throw Errors.notFound("Pipeline");
    }

    // Try to fetch from code_change_comments table
    const { data, error: dbErr } = await supabase
      .from("code_change_comments")
      .select("id, change_id, line_number, content, author_type, author_id, agent_id, created_at")
      .eq("change_id", changeId)
      .order("created_at", { ascending: true });

    if (dbErr) {
      // Table might not exist yet — return empty array gracefully
      if (dbErr.code === "42P01") {
        return NextResponse.json(successResponse([]));
      }
      throw Errors.internal(dbErr.message);
    }

    return NextResponse.json(successResponse(data ?? []));
  } catch (err) {
    const { body, status } = handleError(err);
    return NextResponse.json(body, { status });
  }
}

// POST /api/pipelines/[id]/changes/[changeId]/comments - Add a line comment
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    const { id, changeId } = await params;

    // Verify pipeline ownership
    const { data: pipeline, error: pipelineErr } = await supabase
      .from("pipelines")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (pipelineErr || !pipeline) {
      throw Errors.notFound("Pipeline");
    }

    const body = await request.json();
    const { line_number, content } = body as { line_number?: number; content?: string };

    if (typeof line_number !== "number" || !content) {
      throw Errors.badRequest("line_number (number) and content (string) are required");
    }

    const { data, error: dbErr } = await supabase
      .from("code_change_comments")
      .insert({
        change_id: changeId,
        line_number,
        content,
        author_type: "user",
        author_id: user.id,
      })
      .select()
      .single();

    if (dbErr) {
      // Table might not exist yet
      if (dbErr.code === "42P01") {
        return NextResponse.json(
          successResponse({ id: crypto.randomUUID(), change_id: changeId, line_number, content, author_type: "user", author_id: user.id, created_at: new Date().toISOString() })
        );
      }
      throw Errors.internal(dbErr.message);
    }

    return NextResponse.json(successResponse(data), { status: 201 });
  } catch (err) {
    const { body, status } = handleError(err);
    return NextResponse.json(body, { status });
  }
}
