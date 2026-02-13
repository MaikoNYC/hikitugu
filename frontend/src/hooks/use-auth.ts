"use client";

import { useState, useEffect, useCallback } from "react";
import type { User } from "@/types/database";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Check Supabase session and fetch user from /api/auth/me
    setLoading(false);
  }, []);

  const login = useCallback(async () => {
    window.location.href = "/api/auth/google";
  }, []);

  const logout = useCallback(async () => {
    // TODO: Call POST /api/auth/logout
    setUser(null);
  }, []);

  return { user, loading, login, logout };
}
