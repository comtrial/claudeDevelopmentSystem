import { create } from "zustand";
import type { Profile } from "@/types/session";

interface AuthStore {
  user: Profile | null;
  isAuthenticated: boolean;
  setUser: (user: Profile | null) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  clearUser: () => set({ user: null, isAuthenticated: false }),
}));
