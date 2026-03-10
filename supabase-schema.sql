-- ============================================
-- Kid's Dashboard - Supabase Schema
-- Run this in the Supabase SQL Editor
-- ============================================

-- Medicine Status (tracking what's been given each day)
CREATE TABLE IF NOT EXISTS medicine_status (
    date DATE PRIMARY KEY,
    status JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Medicines Configuration (custom medicines per day)
CREATE TABLE IF NOT EXISTS medicines (
    date DATE PRIMARY KEY,
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bowel Movements
CREATE TABLE IF NOT EXISTS bowel_movements (
    date DATE PRIMARY KEY,
    entries JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings
CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Enable Row Level Security (optional but recommended)
-- ============================================

ALTER TABLE medicine_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE bowel_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (no auth required)
-- You can add auth later and restrict access

CREATE POLICY "Allow all on medicine_status" ON medicine_status
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on medicines" ON medicines
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on bowel_movements" ON bowel_movements
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on settings" ON settings
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Enable Realtime
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE medicine_status;
ALTER PUBLICATION supabase_realtime ADD TABLE medicines;
ALTER PUBLICATION supabase_realtime ADD TABLE bowel_movements;
ALTER PUBLICATION supabase_realtime ADD TABLE settings;

-- ============================================
-- Insert default settings
-- ============================================

INSERT INTO settings (id, config) VALUES (
    'default',
    '{
        "busPickup": "08:30",
        "busDropoff": "15:30",
        "nannyHours": {"start": "13:00", "end": "19:00"},
        "schoolDays": ["Mon", "Tue", "Wed", "Thu", "Fri"]
    }'::jsonb
) ON CONFLICT (id) DO NOTHING;
