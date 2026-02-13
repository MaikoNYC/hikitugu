CREATE TABLE public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.users(id),
    title TEXT NOT NULL,
    target_user_email TEXT,
    generation_mode TEXT NOT NULL CHECK (generation_mode IN ('template', 'ai_proposal')),
    template_id UUID REFERENCES public.templates(id) ON DELETE SET NULL,
    date_range_start DATE,
    date_range_end DATE,
    data_sources TEXT[] NOT NULL DEFAULT '{calendar,slack,spreadsheet}',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'completed', 'error')),
    share_token TEXT UNIQUE,
    share_enabled BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_tenant_id ON public.documents(tenant_id);
CREATE INDEX idx_documents_created_by ON public.documents(created_by);
CREATE INDEX idx_documents_share_token ON public.documents(share_token) WHERE share_token IS NOT NULL;

CREATE TRIGGER set_documents_updated_at
    BEFORE UPDATE ON public.documents
    FOR EACH ROW
    EXECUTE FUNCTION extensions.moddatetime(updated_at);
