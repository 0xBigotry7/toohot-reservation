-- Add time interval capacity settings to admin_settings table
-- This migration adds support for time-based capacity configuration similar to OpenTable

-- First, let's create a more structured format for capacity settings
-- The new format will support time intervals with their respective capacities

-- Update the existing seat_capacity setting to the new format if it exists
UPDATE admin_settings 
SET setting_value = jsonb_build_object(
  'type', 'time_interval',
  'omakase', jsonb_build_object(
    'intervals', jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'startTime', '00:00',
        'endTime', '23:59',
        'capacity', COALESCE((setting_value->>'omakaseSeats')::int, 12)
      )
    )
  ),
  'dining', jsonb_build_object(
    'intervals', jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'startTime', '00:00',
        'endTime', '23:59',
        'capacity', COALESCE((setting_value->>'diningSeats')::int, 24)
      )
    )
  )
),
updated_at = NOW()
WHERE setting_key = 'seat_capacity'
AND setting_value ? 'omakaseSeats'
AND setting_value ? 'diningSeats';

-- Insert default time interval capacity settings if they don't exist
INSERT INTO admin_settings (setting_key, setting_value, updated_at) 
VALUES (
  'seat_capacity',
  jsonb_build_object(
    'type', 'time_interval',
    'omakase', jsonb_build_object(
      'intervals', jsonb_build_array(
        jsonb_build_object(
          'id', gen_random_uuid()::text,
          'startTime', '00:00',
          'endTime', '23:59',
          'capacity', 12
        )
      )
    ),
    'dining', jsonb_build_object(
      'intervals', jsonb_build_array(
        jsonb_build_object(
          'id', gen_random_uuid()::text,
          'startTime', '00:00',
          'endTime', '23:59',
          'capacity', 24
        )
      )
    )
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
--   "type": "time_interval",
--   "omakase": {
--     "intervals": [
--       {
--         "id": "unique-id-1",
--         "startTime": "17:00",
--         "endTime": "19:00",
--         "capacity": 8
--       },
--       {
--         "id": "unique-id-2",
--         "startTime": "19:00",
--         "endTime": "21:00",
--         "capacity": 12
--       }
--     ]
--   },
--   "dining": {
--     "intervals": [
--       {
--         "id": "unique-id-3",
--         "startTime": "12:00",
--         "endTime": "15:00",
--         "capacity": 20
--       },
--       {
--         "id": "unique-id-4",
--         "startTime": "17:00",
--         "endTime": "22:00",
--         "capacity": 30
--       }
--     ]
--   }
-- }