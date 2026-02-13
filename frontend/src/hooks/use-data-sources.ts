"use client";

import { useState, useCallback } from "react";
import type { CalendarEvent, SlackChannel, SpreadsheetSummary } from "@/types/api";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";

export function useDataSources() {
  const { session } = useAuth();
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [slackChannels, setSlackChannels] = useState<SlackChannel[]>([]);
  const [spreadsheets, setSpreadsheets] = useState<SpreadsheetSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCalendarEvents = useCallback(async (dateFrom: string, dateTo: string) => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const res = await apiClient.getWithToken<{ events: CalendarEvent[]; total_count: number }>(
        `/api/data/calendar/events?date_from=${dateFrom}&date_to=${dateTo}`,
        session.access_token
      );
      setCalendarEvents(res.events);
    } catch {
      setCalendarEvents([]);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  const fetchSlackChannels = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const res = await apiClient.getWithToken<{ channels: SlackChannel[] }>(
        "/api/data/slack/channels",
        session.access_token
      );
      setSlackChannels(res.channels);
    } catch {
      setSlackChannels([]);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  const fetchSpreadsheets = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const res = await apiClient.getWithToken<{ spreadsheets: SpreadsheetSummary[] }>(
        "/api/data/spreadsheets",
        session.access_token
      );
      setSpreadsheets(res.spreadsheets);
    } catch {
      setSpreadsheets([]);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  return {
    calendarEvents,
    slackChannels,
    spreadsheets,
    loading,
    fetchCalendarEvents,
    fetchSlackChannels,
    fetchSpreadsheets,
  };
}
