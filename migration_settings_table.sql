-- Platform Settings Table
-- Drop existing table if it exists
DROP TABLE IF EXISTS settings CASCADE;

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings
INSERT INTO settings (key, value, description) VALUES
  ('exam_duration', '60', 'Default exam duration in minutes'),
  ('premium_cost', '199', 'Premium membership cost'),
  ('registration_paused', 'false', 'Whether new registrations are paused')
ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS admin_read_settings ON settings;
DROP POLICY IF EXISTS admin_write_settings ON settings;
DROP POLICY IF EXISTS public_read_settings ON settings;

-- Anyone can read settings (needed for registration checks, etc.)
CREATE POLICY public_read_settings ON settings
  FOR SELECT
  USING (true);

-- Only admins can update settings
CREATE POLICY admin_write_settings ON settings
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

COMMENT ON TABLE settings IS 'Platform-wide configuration settings';
