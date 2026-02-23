"use client";

import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { useRouter } from "next/navigation";

export function useAuth() {
  const router = useRouter();
  const { setUser, clearUser } = useAuthStore();

  const signIn = async (email: string, password: string) => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    router.push("/dashboard");
  };

  const signUp = async (
    email: string,
    password: string,
    displayName: string
  ) => {
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error) throw error;
    router.push("/dashboard");
  };

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearUser();
    router.push("/login");
  };

  return { signIn, signUp, signOut };
}
