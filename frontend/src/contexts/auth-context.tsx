"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { apiClient } from "@/lib/api-client";
import type { AuthStatusResponse } from "@/types/api";

interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  avatar_url: string | null;
  tenant: {
    id: string;
    name: string;
    slug: string;
    plan: string;
  } | null;
}

interface AuthContextValue {
  session: Session | null;
  user: UserProfile | null;
  loading: boolean;
  authStatus: AuthStatusResponse | null;
  login: () => void;
  logout: () => Promise<void>;
  refreshAuthStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authStatus, setAuthStatus] = useState<AuthStatusResponse | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const fetchUserProfile = useCallback(
    async (accessToken: string) => {
      try {
        const profile = await apiClient.getWithToken<UserProfile>(
          "/api/auth/me",
          accessToken
        );
        setUser(profile);
      } catch {
        setUser(null);
      }
    },
    []
  );

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.access_token) {
        fetchUserProfile(s.access_token);
      }
      setLoading(false);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.access_token) {
        fetchUserProfile(s.access_token);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth, fetchUserProfile]);

  const login = useCallback(() => {
    window.location.href = `${API_URL}/api/auth/google`;
  }, []);

  const logout = useCallback(async () => {
    if (session?.access_token) {
      try {
        await apiClient.postWithToken("/api/auth/logout", session.access_token);
      } catch {
        // ignore server-side logout errors
      }
    }
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setAuthStatus(null);
    window.location.href = "/login";
  }, [session, supabase.auth]);

  const refreshAuthStatus = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const status = await apiClient.getWithToken<AuthStatusResponse>(
        "/api/auth/status",
        session.access_token
      );
      setAuthStatus(status);
    } catch {
      setAuthStatus(null);
    }
  }, [session]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        authStatus,
        login,
        logout,
        refreshAuthStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return ctx;
}
