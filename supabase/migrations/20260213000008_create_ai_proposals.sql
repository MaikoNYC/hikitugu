CREATE TABLE public.ai_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    proposed_structure JSONB NOT NULL,
    user_feedback TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'revised')),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_proposals_document_id ON public.ai_proposals(document_id);

CREATE TRIGGER set_ai_proposals_updated_at
    BEFORE UPDATE ON public.ai_proposals
    FOR EACH ROW
    EXECUTE FUNCTION extensions.moddatetime(updated_at);
