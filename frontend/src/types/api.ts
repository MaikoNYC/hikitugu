export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T = unknown> {
  items: T[];
  total_count: number;
  page: number;
  per_page: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  description: string | null;
  attendees: string[];
  location: string | null;
  url: string;
}

export interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  member_count: number;
}

export interface SlackMessage {
  id: string;
  user: string;
  user_name: string;
  text: string;
  timestamp: string;
  thread_replies: Array<{
    id: string;
    user_name: string;
    text: string;
    timestamp: string;
  }>;
  url: string;
}

export interface SpreadsheetSummary {
  id: string;
  title: string;
  url: string;
  last_modified: string;
}

export interface SpreadsheetDetail {
  id: string;
  title: string;
  sheets: Array<{
    name: string;
    headers: string[];
    rows: string[][];
  }>;
}

export interface DataPreviewRequest {
  target_email: string;
  date_from: string;
  date_to: string;
  data_sources: string[];
  slack_channel_ids?: string[];
  spreadsheet_ids?: string[];
}

export interface GenerateRequest {
  title: string;
  target_user_email: string;
  template_id: string;
  date_range_start: string;
  date_range_end: string;
  data_sources: string[];
  slack_channel_ids?: string[];
  spreadsheet_ids?: string[];
}

export interface ProposeRequest {
  title: string;
  target_user_email: string;
  date_range_start: string;
  date_range_end: string;
  data_sources: string[];
  slack_channel_ids?: string[];
  spreadsheet_ids?: string[];
}

export interface ApproveProposalRequest {
  proposal_id: string;
  feedback?: string;
  approved_structure?: Array<{
    title: string;
    description: string;
    estimated_sources: string[];
  }>;
}

export interface GenerationResult {
  document_id: string;
  job_id: string;
  status: string;
  message: string;
}

export interface JobStatus {
  id: string;
  document_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  current_step: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

export interface AuthStatusResponse {
  google: {
    connected: boolean;
    email?: string;
    scopes?: string[];
    expires_at?: string;
  };
  slack: {
    connected: boolean;
    workspace_name?: string;
    scopes?: string[];
  };
}
