-- Add override field to settings table for Home Assistant integration
-- Run this in Supabase SQL Editor if you want manual override capability

-- The settings table already exists. To add an override:
-- UPDATE settings 
-- SET config = jsonb_set(config, '{current_day_override}', '2')
-- WHERE id = 'default';

-- To clear the override (return to calculated rotation):
-- UPDATE settings 
-- SET config = config - 'current_day_override'
-- WHERE id = 'default';

-- Example: Force Day 3 (Turkey) for testing
-- UPDATE settings SET config = jsonb_set(COALESCE(config, '{}'::jsonb), '{current_day_override}', '3') WHERE id = 'default';
