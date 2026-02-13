-- Enable RLS on all tables
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_proposals ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's tenant_id
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID AS $$
    SELECT tenant_id FROM public.users WHERE supabase_auth_id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper function: get current user's id
CREATE OR REPLACE FUNCTION public.get_user_id()
RETURNS UUID AS $$
    SELECT id FROM public.users WHERE supabase_auth_id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Tenants policies
CREATE POLICY "Users can view their own tenant" ON public.tenants
    FOR SELECT USING (id = public.get_user_tenant_id());

-- Users policies
CREATE POLICY "Users can view users in their tenant" ON public.users
    FOR SELECT USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE USING (supabase_auth_id = auth.uid());

-- OAuth tokens policies
CREATE POLICY "Users can manage their own tokens" ON public.oauth_tokens
    FOR ALL USING (user_id = public.get_user_id());

-- Templates policies
CREATE POLICY "Users can view templates in their tenant" ON public.templates
    FOR SELECT USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Users can create templates" ON public.templates
    FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Users can delete their own templates" ON public.templates
    FOR DELETE USING (uploaded_by = public.get_user_id());

-- Documents policies
CREATE POLICY "Users can view documents in their tenant" ON public.documents
    FOR SELECT USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Users can create documents" ON public.documents
    FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Users can update their own documents" ON public.documents
    FOR UPDATE USING (created_by = public.get_user_id());
CREATE POLICY "Users can delete their own documents" ON public.documents
    FOR DELETE USING (created_by = public.get_user_id());

-- Document sections policies
CREATE POLICY "Users can view sections of their tenant documents" ON public.document_sections
    FOR SELECT USING (
        document_id IN (SELECT id FROM public.documents WHERE tenant_id = public.get_user_tenant_id())
    );
CREATE POLICY "Users can update sections of their own documents" ON public.document_sections
    FOR UPDATE USING (
        document_id IN (SELECT id FROM public.documents WHERE created_by = public.get_user_id())
    );

-- Generation jobs policies
CREATE POLICY "Users can view jobs in their tenant" ON public.generation_jobs
    FOR SELECT USING (tenant_id = public.get_user_tenant_id());

-- AI proposals policies
CREATE POLICY "Users can view proposals for their tenant documents" ON public.ai_proposals
    FOR SELECT USING (
        document_id IN (SELECT id FROM public.documents WHERE tenant_id = public.get_user_tenant_id())
    );
CREATE POLICY "Users can update proposals for their own documents" ON public.ai_proposals
    FOR UPDATE USING (
        document_id IN (SELECT id FROM public.documents WHERE created_by = public.get_user_id())
    );
