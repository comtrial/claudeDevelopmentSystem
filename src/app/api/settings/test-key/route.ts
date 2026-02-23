import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { successResponse, errorResponse } from "@/lib/api/response";

// POST /api/settings/test-key - Test an API key validity
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(errorResponse("Unauthorized", "UNAUTHORIZED", 401), { status: 401 });
  }

  const { provider, api_key } = await request.json();

  if (!provider || !api_key) {
    return NextResponse.json(errorResponse("provider and api_key are required", "BAD_REQUEST", 400), { status: 400 });
  }

  // TODO: Implement actual API key validation per provider in subsequent sprint
  return NextResponse.json(
    successResponse({
      provider,
      valid: true,
      message: "API key validation not yet implemented",
    })
  );
}
