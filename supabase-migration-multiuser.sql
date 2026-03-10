-- Migration: Convert to individual records for concurrent multi-user access
-- Run this in Supabase SQL Editor

-- ============================================
-- BOWEL MOVEMENTS - Individual records
-- ============================================

-- Create new table for individual bowel movement entries
CREATE TABLE IF NOT EXISTS bowel_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('normal', 'soft', 'wet', 'good', 'bad')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT -- Optional: track who logged it
);

-- Index for fast date lookups
CREATE INDEX IF NOT EXISTS idx_bowel_entries_date ON bowel_entries(date);

-- Enable RLS
ALTER TABLE bowel_entries ENABLE ROW LEVEL SECURITY;

-- Allow all operations (adjust for your security needs)
CREATE POLICY "bowel_entries_all" ON bowel_entries FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- SLEEP QUALITY - Individual records per date
-- ============================================

-- Sleep table (should already exist, just ensure it has right structure)
CREATE TABLE IF NOT EXISTS sleep (
    date TEXT PRIMARY KEY,
    quality TEXT CHECK (quality IN ('good', 'bad')),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT
);

ALTER TABLE sleep ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sleep_all" ON sleep FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- DAILY NOTES - Individual records per date  
-- ============================================

CREATE TABLE IF NOT EXISTS daily_notes (
    date TEXT PRIMARY KEY,
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT
);

ALTER TABLE daily_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_notes_all" ON daily_notes FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- MEDICINE STATUS - Individual checkboxes
-- ============================================

CREATE TABLE IF NOT EXISTS medicine_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date TEXT NOT NULL,
    slot TEXT NOT NULL CHECK (slot IN ('am', 'pm', 'evening')),
    medicine_name TEXT NOT NULL,
    checked BOOLEAN DEFAULT false,
    checked_at TIMESTAMPTZ,
    checked_by TEXT,
    UNIQUE(date, slot, medicine_name)
);

CREATE INDEX IF NOT EXISTS idx_medicine_checks_date ON medicine_checks(date);

ALTER TABLE medicine_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "medicine_checks_all" ON medicine_checks FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- FOOD DAY CUSTOMIZATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS food_customizations (
    day_id INTEGER PRIMARY KEY CHECK (day_id BETWEEN 1 AND 5),
    categories JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE food_customizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "food_customizations_all" ON food_customizations FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Enable Realtime for all new tables
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE bowel_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE medicine_checks;
ALTER PUBLICATION supabase_realtime ADD TABLE food_customizations;
