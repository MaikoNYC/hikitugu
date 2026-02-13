"use client";

import { useState, useCallback } from "react";
import type { Document } from "@/types/database";

export function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async (page = 1, perPage = 20) => {
    setLoading(true);
    setError(null);
    try {
      // TODO: Call GET /api/documents
      setDocuments([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch documents");
    } finally {
      setLoading(false);
    }
  }, []);

  return { documents, loading, error, fetchDocuments };
}
