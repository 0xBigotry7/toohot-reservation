-- Create email_templates table for storing email template configurations
-- This migration adds email template management that can be configured via the admin panel

CREATE TABLE IF NOT EXISTS email_templates (
  id SERIAL PRIMARY KEY,
  template_key VARCHAR(255) NOT NULL UNIQUE,
  template_name VARCHAR(255) NOT NULL,
  template_type VARCHAR(50) NOT NULL, -- 'confirmation', 'cancellation', 'reminder', 'custom'
  subject VARCHAR(500) NOT NULL,
  html_content TEXT NOT NULL,
  text_content TEXT,
  variables JSONB DEFAULT '[]'::jsonb, -- Array of available variables like ['customer_name', 'reservation_date']
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_email_templates_key ON email_templates(template_key);
CREATE INDEX IF NOT EXISTS idx_email_templates_type ON email_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates(is_active);

-- Enable RLS (Row Level Security) 
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for authenticated users
-- Note: In production, you might want to restrict this to admin users only
CREATE POLICY "Allow all operations for authenticated users" ON email_templates
  FOR ALL USING (auth.role() = 'authenticated');

-- Insert default email templates
INSERT INTO email_templates (template_key, template_name, template_type, subject, html_content, text_content, variables) 
VALUES 
  -- Omakase confirmation template
  (
    'omakase_confirmation',
    'Omakase Reservation Confirmation',
    'confirmation',
    'Your Omakase Reservation at TooHot Kitchen - Confirmed!',
    '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Reservation Confirmed</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 24px; font-weight: bold; color: #d97706; }
        .confirmation-card { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { margin: 10px 0; }
        .label { font-weight: bold; color: #4a5568; }
        .value { color: #2d3748; }
        .footer { text-align: center; margin-top: 30px; color: #718096; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🔥 TooHot Kitchen</div>
            <h1>Reservation Confirmed!</h1>
        </div>
        
        <div class="confirmation-card">
            <h2>Omakase Experience Details</h2>
            <div class="detail-row">
                <span class="label">Guest Name:</span>
                <span class="value">{{customer_name}}</span>
            </div>
            <div class="detail-row">
                <span class="label">Confirmation Code:</span>
                <span class="value">{{confirmation_code}}</span>
            </div>
            <div class="detail-row">
                <span class="label">Date:</span>
                <span class="value">{{reservation_date}}</span>
            </div>
            <div class="detail-row">
                <span class="label">Time:</span>
                <span class="value">{{reservation_time}}</span>
            </div>
            <div class="detail-row">
                <span class="label">Party Size:</span>
                <span class="value">{{party_size}} guests</span>
            </div>
            {{#if special_requests}}
            <div class="detail-row">
                <span class="label">Special Requests:</span>
                <span class="value">{{special_requests}}</span>
            </div>
            {{/if}}
        </div>
        
        <div class="footer">
            <p>Thank you for choosing TooHot Kitchen!</p>
            <p>{{restaurant_email}} | {{restaurant_phone}}</p>
        </div>
    </div>
</body>
</html>',
    'TooHot Kitchen - Reservation Confirmed!

Dear {{customer_name}},

Your Omakase reservation has been confirmed:

Confirmation Code: {{confirmation_code}}
Date: {{reservation_date}}
Time: {{reservation_time}}
Party Size: {{party_size}} guests
{{#if special_requests}}Special Requests: {{special_requests}}{{/if}}

Thank you for choosing TooHot Kitchen!

{{restaurant_email}} | {{restaurant_phone}}',
    '["customer_name", "confirmation_code", "reservation_date", "reservation_time", "party_size", "special_requests", "restaurant_email", "restaurant_phone"]'::jsonb
  ),
  
  -- Dining confirmation template
  (
    'dining_confirmation',
    'Dining Reservation Confirmation',
    'confirmation',
    'Your Dining Reservation at TooHot Kitchen - Confirmed!',
    '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Reservation Confirmed</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 24px; font-weight: bold; color: #d97706; }
        .confirmation-card { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { margin: 10px 0; }
        .label { font-weight: bold; color: #4a5568; }
        .value { color: #2d3748; }
        .footer { text-align: center; margin-top: 30px; color: #718096; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🔥 TooHot Kitchen</div>
            <h1>Reservation Confirmed!</h1>
        </div>
        
        <div class="confirmation-card">
            <h2>Dining Reservation Details</h2>
            <div class="detail-row">
                <span class="label">Guest Name:</span>
                <span class="value">{{customer_name}}</span>
            </div>
            <div class="detail-row">
                <span class="label">Confirmation Code:</span>
                <span class="value">{{confirmation_code}}</span>
            </div>
            <div class="detail-row">
                <span class="label">Date:</span>
                <span class="value">{{reservation_date}}</span>
            </div>
            <div class="detail-row">
                <span class="label">Time:</span>
                <span class="value">{{reservation_time}}</span>
            </div>
            <div class="detail-row">
                <span class="label">Party Size:</span>
                <span class="value">{{party_size}} guests</span>
            </div>
            {{#if duration_minutes}}
            <div class="detail-row">
                <span class="label">Duration:</span>
                <span class="value">{{duration_minutes}} minutes</span>
            </div>
            {{/if}}
            {{#if special_requests}}
            <div class="detail-row">
                <span class="label">Special Requests:</span>
                <span class="value">{{special_requests}}</span>
            </div>
            {{/if}}
        </div>
        
        <div class="footer">
            <p>Thank you for choosing TooHot Kitchen!</p>
            <p>{{restaurant_email}} | {{restaurant_phone}}</p>
        </div>
    </div>
</body>
</html>',
    'TooHot Kitchen - Reservation Confirmed!

Dear {{customer_name}},

Your dining reservation has been confirmed:

Confirmation Code: {{confirmation_code}}
Date: {{reservation_date}}
Time: {{reservation_time}}
Party Size: {{party_size}} guests
{{#if duration_minutes}}Duration: {{duration_minutes}} minutes{{/if}}
{{#if special_requests}}Special Requests: {{special_requests}}{{/if}}

Thank you for choosing TooHot Kitchen!

{{restaurant_email}} | {{restaurant_phone}}',
    '["customer_name", "confirmation_code", "reservation_date", "reservation_time", "party_size", "duration_minutes", "special_requests", "restaurant_email", "restaurant_phone"]'::jsonb
  ),
  
  -- Cancellation template
  (
    'reservation_cancellation',
    'Reservation Cancellation',
    'cancellation',
    'Your Reservation at TooHot Kitchen - Cancelled',
    '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Reservation Cancelled</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 24px; font-weight: bold; color: #d97706; }
        .cancellation-card { background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444; }
        .detail-row { margin: 10px 0; }
        .label { font-weight: bold; color: #4a5568; }
        .value { color: #2d3748; }
        .footer { text-align: center; margin-top: 30px; color: #718096; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🔥 TooHot Kitchen</div>
            <h1>Reservation Cancelled</h1>
        </div>
        
        <div class="cancellation-card">
            <h2>Cancelled Reservation Details</h2>
            <div class="detail-row">
                <span class="label">Guest Name:</span>
                <span class="value">{{customer_name}}</span>
            </div>
            <div class="detail-row">
                <span class="label">Confirmation Code:</span>
                <span class="value">{{confirmation_code}}</span>
            </div>
            <div class="detail-row">
                <span class="label">Date:</span>
                <span class="value">{{reservation_date}}</span>
            </div>
            <div class="detail-row">
                <span class="label">Time:</span>
                <span class="value">{{reservation_time}}</span>
            </div>
            <div class="detail-row">
                <span class="label">Party Size:</span>
                <span class="value">{{party_size}} guests</span>
            </div>
            {{#if cancellation_reason}}
            <div class="detail-row">
                <span class="label">Reason:</span>
                <span class="value">{{cancellation_reason}}</span>
            </div>
            {{/if}}
        </div>
        
        <div class="footer">
            <p>We hope to see you again soon!</p>
            <p>{{restaurant_email}} | {{restaurant_phone}}</p>
        </div>
    </div>
</body>
</html>',
    'TooHot Kitchen - Reservation Cancelled

Dear {{customer_name}},

Your reservation has been cancelled:

Confirmation Code: {{confirmation_code}}
Date: {{reservation_date}}
Time: {{reservation_time}}
Party Size: {{party_size}} guests
{{#if cancellation_reason}}Reason: {{cancellation_reason}}{{/if}}

We hope to see you again soon!

{{restaurant_email}} | {{restaurant_phone}}',
    '["customer_name", "confirmation_code", "reservation_date", "reservation_time", "party_size", "cancellation_reason", "restaurant_email", "restaurant_phone"]'::jsonb
  );

-- Disable RLS for admin operations (similar to admin_settings)
ALTER TABLE email_templates DISABLE ROW LEVEL SECURITY;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_templates_updated_at_trigger
    BEFORE UPDATE ON email_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_email_templates_updated_at();

-- Comments for documentation
COMMENT ON TABLE email_templates IS 'Stores email template configurations for various email types';
COMMENT ON COLUMN email_templates.template_key IS 'Unique identifier for the template';
COMMENT ON COLUMN email_templates.template_name IS 'Human-readable name for the template';
COMMENT ON COLUMN email_templates.template_type IS 'Type of email template (confirmation, cancellation, reminder, custom)';
COMMENT ON COLUMN email_templates.subject IS 'Email subject line with template variables';
COMMENT ON COLUMN email_templates.html_content IS 'HTML version of the email template';
COMMENT ON COLUMN email_templates.text_content IS 'Plain text version of the email template';
COMMENT ON COLUMN email_templates.variables IS 'Array of available template variables';
COMMENT ON COLUMN email_templates.is_active IS 'Whether the template is currently active';

-- Verify the data was inserted
SELECT id, template_key, template_name, template_type, is_active, created_at 
FROM email_templates 
ORDER BY template_key; 