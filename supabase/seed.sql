-- Development seed data for hikitugu
-- Run with: supabase db reset (applies migrations + seed)

-- Create a test tenant
INSERT INTO public.tenants (id, name, slug, plan)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'テスト株式会社',
    'test-corp',
    'free'
);

-- Note: Users are created through Supabase Auth flow.
-- The following is for local development with a pre-seeded auth user.
-- You must first create a user in auth.users (via Supabase Dashboard or CLI).

-- Example: After creating an auth user with id 'AUTH_USER_ID', uncomment:
-- INSERT INTO public.users (id, tenant_id, supabase_auth_id, email, display_name, role)
-- VALUES (
--     '00000000-0000-0000-0000-000000000010',
--     '00000000-0000-0000-0000-000000000001',
--     'AUTH_USER_ID',
--     'test@example.com',
--     'テストユーザー',
--     'owner'
-- );
