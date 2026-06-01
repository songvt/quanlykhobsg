-- Table for Bot Tokens
CREATE TABLE IF NOT EXISTS public.zalo_bot_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT NOT NULL UNIQUE,
    group_name TEXT,
    bot_name TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.zalo_bot_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow admin full access to zalo_bot_tokens" ON public.zalo_bot_tokens FOR ALL TO authenticated USING ( (auth.jwt() ->> 'role') = 'admin' );
CREATE POLICY "Allow public read to zalo_bot_tokens for sending" ON public.zalo_bot_tokens FOR SELECT TO authenticated USING ( true );


-- Table for Personal Contacts
CREATE TABLE IF NOT EXISTS public.zalo_personal_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id TEXT NOT NULL,
    receiver_name TEXT NOT NULL,
    phone TEXT,
    zalo_user_id TEXT NOT NULL,
    bot_api_token TEXT NOT NULL,
    bot_name TEXT,
    notes TEXT,
    status TEXT DEFAULT 'Hoạt động',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uk_zalo_personal_contact_employee UNIQUE (employee_id)
);

-- Enable RLS
ALTER TABLE public.zalo_personal_contacts ENABLE ROW LEVEL SECURITY;

-- Create policy for admin
CREATE POLICY "Allow admin full access to zalo_personal_contacts"
ON public.zalo_personal_contacts
FOR ALL
TO authenticated
USING ( (auth.jwt() ->> 'role') = 'admin' );

CREATE POLICY "Allow public read to zalo_personal_contacts for sending"
ON public.zalo_personal_contacts
FOR SELECT
TO authenticated
USING ( true );
