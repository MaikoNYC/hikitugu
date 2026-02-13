"use client";

import { useState, useCallback } from "react";
import type { CalendarEvent, SlackChannel, SpreadsheetSummary } from "@/types/api";

export function useDataSources() {
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [slackChannels, setSlackChannels] = useState<SlackChannel[]>([]);
  const [spreadsheets, setSpreadsheets] = useState<SpreadsheetSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCalendarEvents = useCallback(async (dateFrom: string, dateTo: string) => {
    // TODO: Call GET /api/data/calendar/events
    setCalendarEvents([]);
  }, []);

  const fetchSlackChannels = useCallback(async () => {
    // TODO: Call GET /api/data/slack/channels
    setSlackChannels([]);
  }, []);

  const fetchSpreadsheets = useCallback(async () => {
    // TODO: Call GET /api/data/spreadsheets
    setSpreadsheets([]);
  }, []);

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
