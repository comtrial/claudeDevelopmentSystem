import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { successResponse, handleError } from "@/lib/api/response";
import { Errors } from "@/lib/api/errors";
import type { PresetTemplate, TemplatesResponse } from "@/types/template";

const TEMPLATE_COLUMNS = "id, title, description, icon, config, is_preset, user_id, created_at";

// GET /api/templates - List preset + user custom templates
export async function GET() {
  try {
    const { supabase } = await getAuthenticatedUser();

    const { data: presets, error: presetsError } = await supabase
      .from("preset_templates")
      .select(TEMPLATE_COLUMNS)
      .eq("is_preset", true)
      .order("created_at", { ascending: true });

    if (presetsError) {
      throw Errors.internal(presetsError.message);
    }

    const { data: custom, error: customError } = await supabase
      .from("preset_templates")
      .select(TEMPLATE_COLUMNS)
      .eq("is_preset", false)
      .order("created_at", { ascending: false });

    if (customError) {
      throw Errors.internal(customError.message);
    }

    const response: TemplatesResponse = {
      presets: (presets as PresetTemplate[]) ?? [],
      custom: (custom as PresetTemplate[]) ?? [],
    };

    return NextResponse.json(successResponse(response));
  } catch (err) {
    const { body, status } = handleError(err);
    return NextResponse.json(body, { status });
  }
}

// POST /api/templates - Create a custom template
export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthenticatedUser();

    const body = await request.json();

    if (!body.title || typeof body.title !== "string" || body.title.trim().length === 0) {
      throw Errors.badRequest("title is required");
    }

    if (!body.config?.agents || !Array.isArray(body.config.agents) || body.config.agents.length === 0) {
      throw Errors.badRequest("config.agents is required and must be a non-empty array");
    }

    const templateId = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const { data, error: dbError } = await supabase
      .from("preset_templates")
      .insert({
        id: templateId,
        title: body.title.trim(),
        description: body.description ?? null,
        icon: body.icon ?? "FileCode",
        config: body.config,
        is_preset: false,
        user_id: user.id,
      })
      .select(TEMPLATE_COLUMNS)
      .single();

    if (dbError) {
      throw Errors.internal(dbError.message);
    }

    return NextResponse.json(successResponse(data as PresetTemplate), { status: 201 });
  } catch (err) {
    const { body, status } = handleError(err);
    return NextResponse.json(body, { status });
  }
}
