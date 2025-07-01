-- Add seat capacity settings to admin_settings table
-- This migration adds initial seat capacity configuration that can be managed via the admin panel

-- Insert default seat capacity settings if they don't exist
INSERT INTO admin_settings (setting_key, setting_value, updated_at) 
VALUES (
  'seat_capacity',
  '{"omakaseSeats": 12, "diningSeats": 24}'::jsonb,
  NOW()
) ON CONFLICT (setting_key) 
DO UPDATE SET 
  setting_value = EXCLUDED.setting_value,
  updated_at = EXCLUDED.updated_at;

-- Verify the data was inserted
SELECT setting_key, setting_value, updated_at 
FROM admin_settings 
WHERE setting_key IN ('auto_confirmation', 'seat_capacity')
ORDER BY setting_key; 