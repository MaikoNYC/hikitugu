CREATE TABLE public.document_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    section_order INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    source_tags TEXT[] NOT NULL DEFAULT '{}',
    source_references JSONB NOT NULL DEFAULT '[]',
    is_ai_generated BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_sections_document_id ON public.document_sections(document_id);

CREATE TRIGGER set_document_sections_updated_at
    BEFORE UPDATE ON public.document_sections
    FOR EACH ROW
    EXECUTE FUNCTION extensions.moddatetime(updated_at);
