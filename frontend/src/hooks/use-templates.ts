"use client";

import { useState, useCallback } from "react";
import type { Template } from "@/types/database";
import type { PaginatedResponse } from "@/types/api";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";

export function useTemplates() {
  const { session } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getWithToken<PaginatedResponse<Template>>(
        "/api/templates",
        session.access_token
      );
      setTemplates(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch templates");
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  return { templates, loading, error, fetchTemplates };
}
