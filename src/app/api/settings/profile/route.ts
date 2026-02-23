import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { successResponse, handleError } from "@/lib/api/response";
import { Errors } from "@/lib/api/errors";

// GET /api/settings/profile - Get user profile
export async function GET() {
  try {
    const { supabase, user } = await getAuthenticatedUser();

    const { data: profile, error: dbError } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, updated_at")
      .eq("id", user.id)
      .single();

    if (dbError && dbError.code !== "PGRST116") {
      throw Errors.internal(dbError.message);
    }

    return NextResponse.json(
      successResponse({
        id: user.id,
        email: user.email ?? null,
        display_name: profile?.display_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
        updated_at: profile?.updated_at ?? null,
      })
    );
  } catch (err) {
    const { body, status } = handleError(err);
    return NextResponse.json(body, { status });
  }
}

// PATCH /api/settings/profile - Update display_name and/or avatar_url
export async function PATCH(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthenticatedUser();

    const body = await request.json();
    const allowed: Record<string, unknown> = {};

    if (typeof body.display_name === "string") {
      allowed.display_name = body.display_name.trim();
    }
    if (typeof body.avatar_url === "string") {
      allowed.avatar_url = body.avatar_url.trim();
    }

    if (Object.keys(allowed).length === 0) {
      throw Errors.badRequest("No valid fields to update");
    }

    const { data, error: dbError } = await supabase
      .from("profiles")
      .update(allowed)
      .eq("id", user.id)
      .select("id, display_name, avatar_url, updated_at")
      .single();

    if (dbError || !data) {
      throw Errors.internal(dbError?.message ?? "Failed to update profile");
    }

    return NextResponse.json(
      successResponse({
        id: user.id,
        email: user.email ?? null,
        display_name: data.display_name ?? null,
        avatar_url: data.avatar_url ?? null,
        updated_at: data.updated_at ?? null,
      })
    );
  } catch (err) {
    const { body, status } = handleError(err);
    return NextResponse.json(body, { status });
  }
}
