-- Run this in Supabase SQL Editor to add remaining multi-user tables
-- (bowel_entries should already exist from previous migration)

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

DROP POLICY IF EXISTS "medicine_checks_all" ON medicine_checks;
CREATE POLICY "medicine_checks_all" ON medicine_checks FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- FOOD DAY CUSTOMIZATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS food_customizations (
    day_id INTEGER PRIMARY KEY CHECK (day_id BETWEEN 1 AND 4),
    categories JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE food_customizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "food_customizations_all" ON food_customizations;
CREATE POLICY "food_customizations_all" ON food_customizations FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Enable Realtime for new tables
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE medicine_checks;
ALTER PUBLICATION supabase_realtime ADD TABLE food_customizations;
