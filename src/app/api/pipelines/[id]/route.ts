import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { successResponse, handleError } from "@/lib/api/response";
import { Errors } from "@/lib/api/errors";

type Params = { params: Promise<{ id: string }> };

// GET /api/pipelines/[id] - Get pipeline details
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    const { id } = await params;

    // Fetch pipeline with tasks, agents, and latest session
    const { data, error: dbError } = await supabase
      .from("pipelines")
      .select("*, tasks(*), agents(*), sessions(id, status, token_usage, token_limit, started_at, completed_at, metadata)")
      .eq("id", id)
      .eq("user_id", user.id)
      .order("created_at", { foreignTable: "sessions", ascending: false })
      .single();

    if (dbError || !data) {
      throw Errors.notFound("Pipeline");
    }

    return NextResponse.json(successResponse(data));
  } catch (err) {
    const { body, status } = handleError(err);
    return NextResponse.json(body, { status });
  }
}

// PATCH /api/pipelines/[id] - Update pipeline
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    const { id } = await params;
    const body = await request.json();

    // Whitelist validation
    const allowedFields = ['title', 'description', 'status', 'mode'];
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.includes(key)) {
        updates[key] = value;
      }
    }
    if (Object.keys(updates).length === 0) {
      throw Errors.badRequest('No valid fields to update');
    }

    const { data, error: dbError } = await supabase
      .from("pipelines")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (dbError || !data) {
      throw Errors.notFound("Pipeline");
    }

    return NextResponse.json(successResponse(data));
  } catch (err) {
    const { body, status } = handleError(err);
    return NextResponse.json(body, { status });
  }
}

// DELETE /api/pipelines/[id] - Delete pipeline
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    const { id } = await params;

    const { error: dbError } = await supabase
      .from("pipelines")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (dbError) {
      throw Errors.internal(dbError.message);
    }

    return NextResponse.json(successResponse(null));
  } catch (err) {
    const { body, status } = handleError(err);
    return NextResponse.json(body, { status });
  }
}
