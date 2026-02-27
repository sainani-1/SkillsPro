-- Add columns for Jitsi meeting integration to class_sessions table

-- Add meeting_type column (jitsi or external)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'class_sessions' AND column_name = 'meeting_type'
  ) THEN
    ALTER TABLE class_sessions ADD COLUMN meeting_type VARCHAR(20) DEFAULT 'jitsi';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'class_sessions' AND column_name = 'meeting_link'
  ) THEN
    ALTER TABLE class_sessions ADD COLUMN meeting_link TEXT;
  END IF;
END $$;

-- Create class_session_participants table for tracking who can join
CREATE TABLE IF NOT EXISTS class_session_participants (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT REFERENCES class_sessions(id) ON DELETE CASCADE,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, student_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_session_participants_session ON class_session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_student ON class_session_participants(student_id);

-- Enable RLS
ALTER TABLE class_session_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for participants
DROP POLICY IF EXISTS "participants_select_policy" ON class_session_participants;
CREATE POLICY "participants_select_policy"
  ON class_session_participants FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('admin', 'teacher')
    ) OR
    auth.uid() = student_id
  );

DROP POLICY IF EXISTS "participants_insert_policy" ON class_session_participants;
CREATE POLICY "participants_insert_policy"
  ON class_session_participants FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('admin', 'teacher')
    )
  );

DROP POLICY IF EXISTS "participants_delete_policy" ON class_session_participants;
CREATE POLICY "participants_delete_policy"
  ON class_session_participants FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('admin', 'teacher')
    )
  );

-- Update existing records to have meeting_type
UPDATE class_sessions 
SET meeting_type = CASE 
  WHEN join_link IS NOT NULL THEN 'external'
  ELSE 'jitsi'
END
WHERE meeting_type IS NULL;

-- Rename scheduled_at to scheduled_for for consistency (if column exists)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'class_sessions' AND column_name = 'scheduled_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'class_sessions' AND column_name = 'scheduled_for'
  ) THEN
    ALTER TABLE class_sessions RENAME COLUMN scheduled_at TO scheduled_for;
  END IF;
END $$;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "class_sessions_jitsi_select_policy" ON class_sessions;
DROP POLICY IF EXISTS "class_sessions_jitsi_insert_policy" ON class_sessions;
DROP POLICY IF EXISTS "class_sessions_jitsi_update_policy" ON class_sessions;

-- Enable RLS if not already enabled
ALTER TABLE class_sessions ENABLE ROW LEVEL SECURITY;

-- Create new policies with unique names
CREATE POLICY "class_sessions_jitsi_select_policy"
  ON class_sessions FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('admin', 'teacher')
    ) OR
    auth.uid() IN (
      SELECT student_id FROM class_session_participants WHERE session_id = class_sessions.id
    ) OR
    NOT EXISTS (
      SELECT 1 FROM class_session_participants WHERE session_id = class_sessions.id
    )
  );

CREATE POLICY "class_sessions_jitsi_insert_policy"
  ON class_sessions FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('admin', 'teacher')
    )
  );

CREATE POLICY "class_sessions_jitsi_update_policy"
  ON class_sessions FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('admin', 'teacher')
    )
  );

-- Add DELETE policy for class_sessions
DROP POLICY IF EXISTS "class_sessions_jitsi_delete_policy" ON class_sessions;
CREATE POLICY "class_sessions_jitsi_delete_policy"
  ON class_sessions FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('admin', 'teacher')
    )
  );

-- Add comments
COMMENT ON COLUMN class_sessions.meeting_type IS 'Type of meeting platform: jitsi (our platform) or external (zoom, meet, etc)';
COMMENT ON COLUMN class_sessions.meeting_link IS 'External meeting link if meeting_type is external';
COMMENT ON TABLE class_session_participants IS 'Students invited to specific class sessions. If empty, all students can join';
