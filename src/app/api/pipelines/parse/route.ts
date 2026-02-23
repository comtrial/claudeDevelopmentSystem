import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { successResponse, errorResponse } from "@/lib/api/response";

// POST /api/pipelines/parse - Parse natural language into pipeline config
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(errorResponse("Unauthorized", "UNAUTHORIZED", 401), { status: 401 });
  }

  const body = await request.json();

  // TODO: Implement NLP parsing logic in subsequent sprint
  return NextResponse.json(
    successResponse({
      input: body.prompt ?? "",
      parsed: { title: "", tasks: [], mode: "auto_edit" },
    })
  );
}
