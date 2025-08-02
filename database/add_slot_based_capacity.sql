-- Add slot-based capacity settings to admin_settings table
-- This migration creates a NEW setting key to avoid breaking production
-- The existing 'seat_capacity' key remains untouched

-- Insert default slot-based capacity settings with new key
INSERT INTO admin_settings (setting_key, setting_value, updated_at) 
VALUES (
  'seat_capacity_v2',
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
WHERE setting_key IN ('seat_capacity', 'seat_capacity_v2');

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