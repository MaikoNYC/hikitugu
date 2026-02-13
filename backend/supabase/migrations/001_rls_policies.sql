-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_proposals ENABLE ROW LEVEL SECURITY;

-- tenants: 自テナントのみ読み取り
CREATE POLICY "Users can view own tenant" ON tenants FOR SELECT
  USING (id IN (SELECT tenant_id FROM users WHERE supabase_auth_id = auth.uid()::text));

-- users: 自テナントのユーザーのみ
CREATE POLICY "Users can view tenant members" ON users FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE supabase_auth_id = auth.uid()::text));

-- oauth_tokens: 自分のトークンのみ
CREATE POLICY "Users can manage own tokens" ON oauth_tokens FOR ALL
  USING (user_id IN (SELECT id FROM users WHERE supabase_auth_id = auth.uid()::text));

-- documents: 自テナントのドキュメント
CREATE POLICY "Users can manage tenant documents" ON documents FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE supabase_auth_id = auth.uid()::text));

-- document_sections: ドキュメント経由
CREATE POLICY "Users can manage tenant sections" ON document_sections FOR ALL
  USING (document_id IN (SELECT id FROM documents WHERE tenant_id IN
    (SELECT tenant_id FROM users WHERE supabase_auth_id = auth.uid()::text)));

-- templates: 自テナント
CREATE POLICY "Users can manage tenant templates" ON templates FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE supabase_auth_id = auth.uid()::text));

-- generation_jobs: 自テナント
CREATE POLICY "Users can view tenant jobs" ON generation_jobs FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE supabase_auth_id = auth.uid()::text));

-- ai_proposals: ドキュメント経由
CREATE POLICY "Users can manage tenant proposals" ON ai_proposals FOR ALL
  USING (document_id IN (SELECT id FROM documents WHERE tenant_id IN
    (SELECT tenant_id FROM users WHERE supabase_auth_id = auth.uid()::text)));
