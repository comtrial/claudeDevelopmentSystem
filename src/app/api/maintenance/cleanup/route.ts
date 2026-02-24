import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// POST /api/maintenance/cleanup
// Triggers cleanup of old agent_logs when DB exceeds threshold
export async function POST() {
  try {
    const admin = getServiceClient();

    const { data, error } = await admin.rpc("cleanup_old_logs", {
      threshold_mb: 400,
      delete_mb: 100,
    });

    if (error) {
      console.error("[cleanup] RPC error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = data?.[0] ?? { deleted_count: 0, db_size_mb: 0 };
    console.log(
      `[cleanup] DB size: ${result.db_size_mb}MB, deleted: ${result.deleted_count} rows`
    );

    return NextResponse.json({
      deleted_count: result.deleted_count,
      db_size_mb: Number(result.db_size_mb).toFixed(1),
    });
  } catch (err) {
    console.error("[cleanup] Error:", err);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}

// GET /api/maintenance/cleanup - Check current DB size
export async function GET() {
  try {
    const admin = getServiceClient();

    const { data, error } = await admin.rpc("cleanup_old_logs", {
      threshold_mb: 999999, // Very high threshold = just report size, no delete
      delete_mb: 0,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = data?.[0] ?? { db_size_mb: 0 };
    return NextResponse.json({
      db_size_mb: Number(result.db_size_mb).toFixed(1),
      threshold_mb: 400,
    });
  } catch (err) {
    return NextResponse.json({ error: "Check failed" }, { status: 500 });
  }
}
