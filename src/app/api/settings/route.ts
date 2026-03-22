import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { successResponse, handleError } from "@/lib/api/response";
import { Errors } from "@/lib/api/errors";

const DEFAULT_SETTINGS = {
  theme: { colorMode: "system" as const, accentColor: "neutral" },
  tokenPolicy: { defaultBudget: 50000, warningThresholds: [60, 80, 90], autoStopOnBudget: false },
  notifications: { emailOnComplete: false, emailOnError: true, browserNotifications: false, soundEnabled: false },
};

// GET /api/settings - Get user settings (create default if not exists)
export async function GET() {
  try {
    const { supabase, user } = await getAuthenticatedUser();

    const { data, error: dbError } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (dbError && dbError.code !== "PGRST116") {
      throw Errors.internal(dbError.message);
    }

    if (!data) {
      // Create default settings
      const { data: created, error: createError } = await supabase
        .from("user_settings")
        .insert({ user_id: user.id, settings: DEFAULT_SETTINGS })
        .select("*")
        .single();

      if (createError || !created) {
        throw Errors.internal(createError?.message ?? "Failed to create settings");
      }

      return NextResponse.json(successResponse(created));
    }

    return NextResponse.json(successResponse(data));
  } catch (err) {
    const { body, status } = handleError(err);
    return NextResponse.json(body, { status });
  }
}

// PATCH /api/settings - Merge partial settings into existing JSONB
export async function PATCH(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthenticatedUser();

    const body = await request.json();
    delete body.user_id;

    // Get existing settings
    const { data: existing } = await supabase
      .from("user_settings")
      .select("settings")
      .eq("user_id", user.id)
      .single();

    const existingSettings = (existing?.settings as Record<string, unknown>) ?? DEFAULT_SETTINGS;

    // Deep merge: top-level keys in body.settings override existing keys
    const mergedSettings =
      body.settings && typeof body.settings === "object"
        ? { ...existingSettings, ...body.settings }
        : existingSettings;

    const updatePayload = { ...body };
    if (body.settings) {
      updatePayload.settings = mergedSettings;
    }

    const { data, error: dbError } = await supabase
      .from("user_settings")
      .update(updatePayload)
      .eq("user_id", user.id)
      .select()
      .single();

    if (dbError || !data) {
      throw Errors.internal(dbError?.message ?? "Failed to update settings");
    }

    return NextResponse.json(successResponse(data));
  } catch (err) {
    const { body, status } = handleError(err);
    return NextResponse.json(body, { status });
  }
}
