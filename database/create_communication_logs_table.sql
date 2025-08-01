-- Create communication_logs table to track all email communications
CREATE TABLE IF NOT EXISTS communication_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id UUID NOT NULL,
  reservation_type VARCHAR(50) NOT NULL CHECK (reservation_type IN ('omakase', 'dining')),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(50),
  customer_name VARCHAR(255),
  
  -- Communication details
  channel VARCHAR(50) NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms', 'phone', 'other')),
  direction VARCHAR(50) NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound', 'inbound')),
  subject TEXT,
  content TEXT NOT NULL,
  template_used VARCHAR(100), -- e.g., 'omakase_confirmation', 'dining_confirmation', 'cancellation'
  
  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced', 'opened', 'clicked')),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  
  -- Provider information
  provider VARCHAR(50) DEFAULT 'resend', -- email provider used
  provider_message_id VARCHAR(255), -- ID from the email provider
  provider_response JSONB, -- Full response from provider
  error_message TEXT,
  
  -- Metadata
  metadata JSONB, -- Additional data like refund info, special notes, etc.
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_communication_logs_reservation ON communication_logs(reservation_id, reservation_type);
CREATE INDEX idx_communication_logs_customer_email ON communication_logs(customer_email);
CREATE INDEX idx_communication_logs_status ON communication_logs(status);
CREATE INDEX idx_communication_logs_created_at ON communication_logs(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role full access
CREATE POLICY "Service role has full access to communication_logs" ON communication_logs
  FOR ALL USING (true);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_communication_logs_updated_at BEFORE UPDATE
  ON communication_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE communication_logs IS 'Stores all communication history with customers including emails, SMS, and phone calls';
COMMENT ON COLUMN communication_logs.template_used IS 'Template identifier used for the communication (e.g., omakase_confirmation, dining_confirmation)';
COMMENT ON COLUMN communication_logs.provider_response IS 'Full JSON response from the communication provider for debugging';
COMMENT ON COLUMN communication_logs.metadata IS 'Additional contextual data like refund amounts, cancellation reasons, etc.';