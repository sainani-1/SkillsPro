-- Fix notifications system by creating tables and adding RLS policies

-- Create admin_notifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS admin_notifications (
  id BIGSERIAL PRIMARY KEY,
  admin_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'info', -- info|warning|success
  target_role TEXT DEFAULT 'all', -- all|student|teacher
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add target_role column if it doesn't exist (for existing tables)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admin_notifications' AND column_name = 'target_role'
  ) THEN
    ALTER TABLE admin_notifications ADD COLUMN target_role TEXT DEFAULT 'all';
  END IF;
END $$;

-- Create notification_reads table if it doesn't exist
CREATE TABLE IF NOT EXISTS notification_reads (
  id BIGSERIAL PRIMARY KEY,
  notification_id BIGINT REFERENCES admin_notifications(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (notification_id, user_id)
);

-- Enable RLS on both tables
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "admin_notifications_select_policy" ON admin_notifications;
DROP POLICY IF EXISTS "admin_notifications_insert_policy" ON admin_notifications;
DROP POLICY IF EXISTS "admin_notifications_update_policy" ON admin_notifications;
DROP POLICY IF EXISTS "admin_notifications_delete_policy" ON admin_notifications;
DROP POLICY IF EXISTS "notification_reads_select_policy" ON notification_reads;
DROP POLICY IF EXISTS "notification_reads_insert_policy" ON notification_reads;
DROP POLICY IF EXISTS "notification_reads_delete_policy" ON notification_reads;

-- Admin Notifications Policies
-- Anyone can read notifications targeted to their role or 'all'
CREATE POLICY "admin_notifications_select_policy"
  ON admin_notifications FOR SELECT
  USING (
    target_role = 'all' OR
    target_role = (SELECT role FROM profiles WHERE id = auth.uid())
  );

-- Only admins can create notifications
CREATE POLICY "admin_notifications_insert_policy"
  ON admin_notifications FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
  );

-- Only admins can update their own notifications
CREATE POLICY "admin_notifications_update_policy"
  ON admin_notifications FOR UPDATE
  USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
  );

-- Only admins can delete notifications
CREATE POLICY "admin_notifications_delete_policy"
  ON admin_notifications FOR DELETE
  USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
  );

-- Notification Reads Policies
-- Users can see their own read records
CREATE POLICY "notification_reads_select_policy"
  ON notification_reads FOR SELECT
  USING (user_id = auth.uid());

-- Users can mark notifications as read
CREATE POLICY "notification_reads_insert_policy"
  ON notification_reads FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own read records
CREATE POLICY "notification_reads_delete_policy"
  ON notification_reads FOR DELETE
  USING (user_id = auth.uid());

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admin_notifications_target_role ON admin_notifications(target_role);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON admin_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_reads_user_id ON notification_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_reads_notification_id ON notification_reads(notification_id);

-- Add comments
COMMENT ON TABLE admin_notifications IS 'System-wide notifications sent by admins to users';
COMMENT ON TABLE notification_reads IS 'Tracks which users have read which notifications';
