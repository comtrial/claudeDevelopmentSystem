import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { successResponse, handleError } from "@/lib/api/response";
import { Errors } from "@/lib/api/errors";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/sessions/[id]/tokens
// Body: { tokensToAdd: number }
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    const { id } = await params;

    // Verify session ownership via pipeline
    const { data: session, error: fetchErr } = await supabase
      .from("sessions")
      .select("id, token_usage, token_limit, status, pipelines!inner(user_id)")
      .eq("id", id)
      .eq("pipelines.user_id", user.id)
      .single();

    if (fetchErr || !session) {
      throw Errors.notFound("Session");
    }

    const body = await request.json();
    const tokensToAdd = Number(body?.tokensToAdd);

    if (!Number.isFinite(tokensToAdd) || tokensToAdd <= 0) {
      throw Errors.badRequest("tokensToAdd must be a positive number");
    }

    const newTokenUsage = session.token_usage + tokensToAdd;
    const percentage = session.token_limit > 0
      ? Math.round((newTokenUsage / session.token_limit) * 100)
      : 0;

    // Set session to 'warning' if usage reaches 90%
    const newStatus = percentage >= 90 ? "warning" : session.status;

    const { data: updated, error: updateErr } = await supabase
      .from("sessions")
      .update({
        token_usage: newTokenUsage,
        status: newStatus,
      })
      .eq("id", id)
      .select("id, token_usage, token_limit, status")
      .single();

    if (updateErr || !updated) {
      throw Errors.internal(updateErr?.message ?? "Failed to update token usage");
    }

    return NextResponse.json(
      successResponse({
        ...updated,
        percentage,
      })
    );
  } catch (err) {
    const { body, status } = handleError(err);
    return NextResponse.json(body, { status });
  }
}
