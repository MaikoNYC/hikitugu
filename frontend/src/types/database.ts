export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: "free" | "pro" | "enterprise";
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  tenant_id: string;
  supabase_auth_id: string;
  email: string;
  display_name: string | null;
  role: "owner" | "admin" | "member";
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface OAuthToken {
  id: string;
  user_id: string;
  provider: "google" | "slack";
  encrypted_access_token: string;
  encrypted_refresh_token: string | null;
  token_expires_at: string | null;
  scopes: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Template {
  id: string;
  tenant_id: string;
  uploaded_by: string | null;
  name: string;
  description: string | null;
  file_path: string;
  file_type: "docx" | "pdf";
  file_size_bytes: number | null;
  parsed_structure: {
    sections: Array<{
      order: number;
      title: string;
      level: number;
      style?: Record<string, unknown>;
    }>;
  } | null;
  status: "processing" | "ready" | "error";
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  tenant_id: string;
  created_by: string | null;
  title: string;
  target_user_email: string | null;
  generation_mode: "template" | "ai_proposal";
  template_id: string | null;
  date_range_start: string | null;
  date_range_end: string | null;
  data_sources: string[];
  status: "draft" | "generating" | "completed" | "error";
  share_token: string | null;
  share_enabled: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DocumentSection {
  id: string;
  document_id: string;
  section_order: number;
  title: string;
  content: string | null;
  source_tags: string[];
  source_references: Array<{
    source: string;
    id: string;
    title: string;
    url: string;
  }>;
  is_ai_generated: boolean;
  created_at: string;
  updated_at: string;
}

export interface GenerationJob {
  id: string;
  document_id: string;
  tenant_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  current_step: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface AiProposal {
  id: string;
  document_id: string;
  proposed_structure: Array<{
    title: string;
    description: string;
    estimated_sources: string[];
  }>;
  user_feedback: string | null;
  status: "pending" | "approved" | "rejected" | "revised";
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}
