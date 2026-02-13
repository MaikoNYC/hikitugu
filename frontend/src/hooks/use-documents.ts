"use client";

import { useState, useCallback } from "react";
import type { Document } from "@/types/database";
import type { PaginatedResponse } from "@/types/api";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";

export function useDocuments() {
  const { session } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async (page = 1, perPage = 20) => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getWithToken<PaginatedResponse<Document>>(
        `/api/documents?page=${page}&per_page=${perPage}`,
        session.access_token
      );
      setDocuments(res.items);
      setTotalCount(res.total_count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch documents");
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  return { documents, totalCount, loading, error, fetchDocuments };
}
