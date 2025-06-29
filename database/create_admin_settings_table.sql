-- Create admin_settings table for storing application configuration
CREATE TABLE IF NOT EXISTS admin_settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(255) NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on setting_key for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_settings_key ON admin_settings(setting_key);

-- Enable RLS (Row Level Security) 
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for authenticated users
-- Note: In production, you might want to restrict this to admin users only
CREATE POLICY "Allow all operations for authenticated users" ON admin_settings
  FOR ALL USING (auth.role() = 'authenticated');

-- Insert default auto-confirmation settings if they don't exist
INSERT INTO admin_settings (setting_key, setting_value, updated_at) 
VALUES (
  'auto_confirmation',
  '{"autoConfirmOmakase": false, "autoConfirmDining": true}'::jsonb,
  NOW()
) ON CONFLICT (setting_key) DO NOTHING;

-- Comment for documentation
COMMENT ON TABLE admin_settings IS 'Stores application-wide configuration settings as key-value pairs with JSONB values';
COMMENT ON COLUMN admin_settings.setting_key IS 'Unique identifier for the setting';
COMMENT ON COLUMN admin_settings.setting_value IS 'JSON object containing the setting configuration';
COMMENT ON COLUMN admin_settings.created_at IS 'When the setting was first created';
COMMENT ON COLUMN admin_settings.updated_at IS 'When the setting was last modified'; 