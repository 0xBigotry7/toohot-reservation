-- Update availability settings to support shift-based dining availability
-- This migration updates the availability_settings to support lunch/dinner shifts per day

-- The new structure will be:
-- {
--   "omakaseAvailableDays": [4], // Still just days for omakase
--   "diningAvailableDays": [0, 1, 2, 3, 4, 5, 6], // Still supported for backward compatibility
--   "diningAvailableShifts": {
--     "0": ["lunch", "dinner"], // Sunday: both shifts
--     "1": ["lunch"],           // Monday: lunch only
--     "2": ["dinner"],          // Tuesday: dinner only
--     "3": ["lunch", "dinner"], // Wednesday: both
--     "4": ["lunch", "dinner"], // Thursday: both
--     "5": ["lunch", "dinner"], // Friday: both
--     "6": ["lunch", "dinner"]  // Saturday: both
--   }
-- }

-- First, let's check current availability settings
SELECT setting_key, setting_value 
FROM admin_settings 
WHERE setting_key = 'availability_settings';

-- Update existing availability settings to include shift information
UPDATE admin_settings 
SET setting_value = 
  CASE 
    WHEN setting_value ? 'diningAvailableShifts' THEN setting_value
    ELSE jsonb_build_object(
      'omakaseAvailableDays', COALESCE(setting_value->'omakaseAvailableDays', '[4]'::jsonb),
      'diningAvailableDays', COALESCE(setting_value->'diningAvailableDays', '[0,1,2,3,4,5,6]'::jsonb),
      'diningAvailableShifts', jsonb_build_object(
        '0', '["lunch", "dinner"]'::jsonb,
        '1', '["lunch", "dinner"]'::jsonb,
        '2', '["lunch", "dinner"]'::jsonb,
        '3', '["lunch", "dinner"]'::jsonb,
        '4', '["lunch", "dinner"]'::jsonb,
        '5', '["lunch", "dinner"]'::jsonb,
        '6', '["lunch", "dinner"]'::jsonb
      )
    )
  END,
  updated_at = NOW()
WHERE setting_key = 'availability_settings';

-- Verify the update
SELECT setting_key, setting_value 
FROM admin_settings 
WHERE setting_key = 'availability_settings';