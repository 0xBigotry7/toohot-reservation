-- Add Availability Settings for Omakase/Dining Reservation Types
-- This migration adds configurable day-of-week availability for each reservation type
-- Replaces hardcoded Thursday-only omakase rule with flexible database configuration

-- The availability_settings are stored in the existing admin_settings table
-- with the structure:
-- {
--   "omakaseAvailableDays": [4],  // Thursday only by default
--   "diningAvailableDays": [0,1,2,3,4,5,6]  // All days by default
-- }
-- Where days are: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday

-- Insert default availability settings (optional - the API will create defaults if none exist)
INSERT INTO admin_settings (setting_key, setting_value, updated_at)
VALUES (
  'availability_settings',
  '{
    "omakaseAvailableDays": [4],
    "diningAvailableDays": [0, 1, 2, 3, 4, 5, 6]
  }'::jsonb,
  NOW()
)
ON CONFLICT (setting_key) DO NOTHING;

-- Verify the insertion
SELECT setting_key, setting_value, updated_at 
FROM admin_settings 
WHERE setting_key = 'availability_settings';

-- Migration Notes:
-- 1. This uses the existing admin_settings table structure
-- 2. Default: Omakase available Thursday only, Dining available all days
-- 3. Admins can configure via Settings panel in admin dashboard
-- 4. API endpoints: /api/get-availability-settings and /api/save-availability-settings
-- 5. Reservation availability is now checked in /api/mcp/check-availability 