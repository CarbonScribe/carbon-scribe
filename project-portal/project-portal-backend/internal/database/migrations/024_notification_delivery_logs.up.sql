-- Create notification_delivery_logs table for tracking alert notification delivery attempts
CREATE TABLE IF NOT EXISTS notification_delivery_logs (
    id VARCHAR(36) PRIMARY KEY,
    alert_id VARCHAR(36) NOT NULL,
    rule_id VARCHAR(36) NOT NULL,
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('email', 'webhook', 'websocket', 'sms')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'retrying')),
    attempt_count INTEGER NOT NULL DEFAULT 1,
    error TEXT,
    error_code VARCHAR(100),
    details JSONB,
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_notification_delivery_logs_alert_id ON notification_delivery_logs(alert_id);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_logs_rule_id ON notification_delivery_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_logs_status ON notification_delivery_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_logs_channel ON notification_delivery_logs(channel);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_logs_created_at ON notification_delivery_logs(created_at DESC);

-- Add comment
COMMENT ON TABLE notification_delivery_logs IS 'Tracks delivery attempts for alert notifications across all channels';
