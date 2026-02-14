"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { JobStatus } from "@/types/api";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase";

export function useJobStatus(jobId: string | null) {
  const { session } = useAuth();
  const [job, setJob] = useState<JobStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  const isTerminal = (status: string) =>
    status === "completed" || status === "failed";

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (channelRef.current) {
      const supabase = createClient();
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  const startPollingFallback = useCallback(
    (token: string) => {
      if (intervalRef.current) return;

      const poll = async () => {
        try {
          const res = await apiClient.getWithToken<JobStatus>(
            `/api/documents/jobs/${jobId}`,
            token
          );
          setJob(res);
          if (isTerminal(res.status) && intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        } catch {
          // ignore polling errors
        }
      };

      intervalRef.current = setInterval(poll, 3000);
    },
    [jobId]
  );

  useEffect(() => {
    if (!jobId || !session?.access_token) return;

    setLoading(true);

    // Initial fetch
    const fetchInitial = async () => {
      try {
        const res = await apiClient.getWithToken<JobStatus>(
          `/api/documents/jobs/${jobId}`,
          session.access_token
        );
        setJob(res);
        setLoading(false);

        if (isTerminal(res.status)) return;

        // Subscribe to Realtime updates
        const supabase = createClient();
        const channel = supabase
          .channel(`job-${jobId}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "generation_jobs",
              filter: `id=eq.${jobId}`,
            },
            (payload) => {
              const updated = payload.new as Record<string, unknown>;
              const mapped: JobStatus = {
                id: updated.id as string,
                document_id: updated.document_id as string,
                status: updated.status as JobStatus["status"],
                progress: updated.progress as number,
                current_step: (updated.current_step as string) || null,
                started_at: (updated.started_at as string) || null,
                completed_at: (updated.completed_at as string) || null,
                error_message: (updated.error_message as string) || null,
              };
              setJob(mapped);

              if (isTerminal(mapped.status)) {
                cleanup();
              }
            }
          )
          .subscribe((status) => {
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              // Realtime failed — fall back to polling
              startPollingFallback(session.access_token);
            }
          });

        channelRef.current = channel;
      } catch {
        setLoading(false);
        // Initial fetch failed — try polling
        startPollingFallback(session.access_token);
      }
    };

    fetchInitial();

    return cleanup;
  }, [jobId, session?.access_token, cleanup, startPollingFallback]);

  return { job, loading };
}
