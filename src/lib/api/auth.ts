import { createClient } from "@/lib/supabase/server";
import { Errors } from "./errors";

export async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw Errors.unauthorized();
  }

  return { supabase, user };
}
