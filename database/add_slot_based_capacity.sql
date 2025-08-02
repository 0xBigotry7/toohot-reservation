-- Add slot-based capacity settings to admin_settings table
-- This migration adds support for OpenTable-style slot-based capacity configuration

-- Update any existing time_interval settings to slot_based format
UPDATE admin_settings 
SET setting_value = jsonb_build_object(
  'type', 'slot_based',
  'slotDuration', 30,
  'omakase', jsonb_build_array(),
  'dining', jsonb_build_array()
),
updated_at = NOW()
WHERE setting_key = 'seat_capacity'
AND setting_value->>'type' = 'time_interval';

-- Convert legacy simple capacity to slot-based format
UPDATE admin_settings 
SET setting_value = jsonb_build_object(
  'type', 'slot_based',
  'slotDuration', 30,
  'omakase', jsonb_build_array(),
  'dining', jsonb_build_array()
),
updated_at = NOW()
WHERE setting_key = 'seat_capacity'
AND setting_value ? 'omakaseSeats'
AND setting_value ? 'diningSeats';

-- Insert default slot-based capacity settings if they don't exist
INSERT INTO admin_settings (setting_key, setting_value, updated_at) 
VALUES (
  'seat_capacity',
  jsonb_build_object(
    'type', 'slot_based',
    'slotDuration', 30,
    'omakase', jsonb_build_array(),
    'dining', jsonb_build_array()
  ),
  NOW()
) ON CONFLICT (setting_key) DO NOTHING;

-- Verify the data structure
SELECT setting_key, 
       jsonb_pretty(setting_value) as formatted_value,
       updated_at 
FROM admin_settings 
WHERE setting_key = 'seat_capacity';

-- Example of how the data structure looks:
-- {
--   "type": "slot_based",
--   "slotDuration": 30,
--   "omakase": [
--     {
--       "time": "17:00",
--       "covers": 8,
--       "parties": 2,
--       "enabled": true
--     },
--     {
--       "time": "17:30",
--       "covers": 8,
--       "parties": 2,
--       "enabled": true
--     },
--     {
--       "time": "19:00",
--       "covers": 12,
--       "parties": 3,
--       "enabled": true
--     }
--   ],
--   "dining": [
--     {
--       "time": "12:00",
--       "covers": 20,
--       "parties": 5,
--       "enabled": true
--     },
--     {
--       "time": "12:30",
--       "covers": 20,
--       "parties": 5,
--       "enabled": true
--     },
--     {
--       "time": "17:00",
--       "covers": 30,
--       "parties": 8,
--       "enabled": true
--     }
--   ]
-- }