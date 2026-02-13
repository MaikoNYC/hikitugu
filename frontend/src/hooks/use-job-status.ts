"use client";

import { useState, useEffect } from "react";
import type { GenerationJob } from "@/types/database";

export function useJobStatus(jobId: string | null) {
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!jobId) return;

    // TODO: Subscribe to Supabase Realtime for generation_jobs updates
    // Fallback: poll GET /api/jobs/{jobId}
    setLoading(true);

    return () => {
      // Cleanup subscription
    };
  }, [jobId]);

  return { job, loading };
}
