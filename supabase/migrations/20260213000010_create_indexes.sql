-- Additional composite indexes for common query patterns
CREATE INDEX idx_documents_tenant_status ON public.documents(tenant_id, status);
CREATE INDEX idx_documents_tenant_created ON public.documents(tenant_id, created_at DESC);
CREATE INDEX idx_generation_jobs_tenant_status ON public.generation_jobs(tenant_id, status);
CREATE INDEX idx_document_sections_order ON public.document_sections(document_id, section_order);

-- Enable moddatetime extension (used by update triggers)
CREATE EXTENSION IF NOT EXISTS moddatetime WITH SCHEMA extensions;
