-- Add closed dates settings to admin_settings table
-- This migration adds the closed dates configuration that can be managed via the admin panel

-- Insert default closed dates settings if they don't exist
INSERT INTO admin_settings (setting_key, setting_value, updated_at) 
VALUES (
  'closed_dates',
  '{"dates": []}'::jsonb,
  NOW()
) ON CONFLICT (setting_key) 
DO UPDATE SET 
  setting_value = EXCLUDED.setting_value,
  updated_at = EXCLUDED.updated_at;

-- Verify the data was inserted
SELECT setting_key, setting_value, updated_at 
FROM admin_settings 
WHERE setting_key = 'closed_dates'
ORDER BY setting_key; 