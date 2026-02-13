"use client";

import { useState, useEffect, useRef } from "react";
import type { JobStatus } from "@/types/api";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";

export function useJobStatus(jobId: string | null) {
  const { session } = useAuth();
  const [job, setJob] = useState<JobStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!jobId || !session?.access_token) return;

    setLoading(true);

    const poll = async () => {
      try {
        const res = await apiClient.getWithToken<JobStatus>(
          `/api/documents/jobs/${jobId}`,
          session.access_token
        );
        setJob(res);
        setLoading(false);

        if (res.status === "completed" || res.status === "failed") {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      } catch {
        setLoading(false);
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 3000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [jobId, session?.access_token]);

  return { job, loading };
}
