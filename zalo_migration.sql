-- Zalo Configs Table
CREATE TABLE IF NOT EXISTS zalo_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id VARCHAR,
    oa_id VARCHAR,
    environment VARCHAR DEFAULT 'development',
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    secret_key_encrypted TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    webhook_url TEXT,
    is_active BOOLEAN DEFAULT false,
    last_checked_at TIMESTAMP WITH TIME ZONE,
    last_check_status VARCHAR,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Zalo Templates Table
CREATE TABLE IF NOT EXISTS zalo_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id VARCHAR UNIQUE NOT NULL,
    template_name VARCHAR,
    template_type VARCHAR,
    content_preview TEXT,
    params_schema JSONB,
    status VARCHAR DEFAULT 'pending',
    is_active BOOLEAN DEFAULT true,
    last_synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Zalo Campaigns Table
CREATE TABLE IF NOT EXISTS zalo_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_code VARCHAR UNIQUE NOT NULL,
    name VARCHAR,
    template_id UUID REFERENCES zalo_templates(id),
    send_mode VARCHAR DEFAULT 'now',
    status VARCHAR DEFAULT 'draft',
    scheduled_at TIMESTAMP WITH TIME ZONE,
    total_recipients INT DEFAULT 0,
    total_sent INT DEFAULT 0,
    total_success INT DEFAULT 0,
    total_failed INT DEFAULT 0,
    created_by UUID, -- Can link to auth.users if needed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Zalo Notification Logs / Queue Table
CREATE TABLE IF NOT EXISTS zalo_notification_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES zalo_campaigns(id) ON DELETE SET NULL,
    template_id UUID REFERENCES zalo_templates(id),
    recipient_phone VARCHAR,
    recipient_uid VARCHAR,
    params JSONB,
    rendered_payload JSONB,
    provider_message_id VARCHAR UNIQUE,
    idempotency_key VARCHAR UNIQUE,
    status VARCHAR DEFAULT 'pending', -- pending, sent, delivered, failed, retrying
    attempt_count INT DEFAULT 0,
    max_attempts INT DEFAULT 3,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    request_payload JSONB,
    response_payload JSONB,
    error_code VARCHAR,
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Zalo Webhook Events Table
CREATE TABLE IF NOT EXISTS zalo_webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id VARCHAR,
    event_name VARCHAR,
    provider_message_id VARCHAR,
    payload JSONB,
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE zalo_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE zalo_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE zalo_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE zalo_notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE zalo_webhook_events ENABLE ROW LEVEL SECURITY;

-- Create generic policies (allow all for authenticated for now, refine as needed)
CREATE POLICY "Enable all for authenticated users" ON zalo_configs FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON zalo_templates FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON zalo_campaigns FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON zalo_notification_logs FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON zalo_webhook_events FOR ALL TO authenticated USING (true);

-- Enable all operations for anon (if app relies on server-side anon key operations)
CREATE POLICY "Enable all for anon" ON zalo_configs FOR ALL TO anon USING (true);
CREATE POLICY "Enable all for anon" ON zalo_templates FOR ALL TO anon USING (true);
CREATE POLICY "Enable all for anon" ON zalo_campaigns FOR ALL TO anon USING (true);
CREATE POLICY "Enable all for anon" ON zalo_notification_logs FOR ALL TO anon USING (true);
CREATE POLICY "Enable all for anon" ON zalo_webhook_events FOR ALL TO anon USING (true);
