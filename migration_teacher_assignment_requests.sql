-- Teacher Assignment Requests Table
-- Drop existing table if it exists (WARNING: This will delete all existing data)
DROP TABLE IF EXISTS teacher_assignment_requests CASCADE;

CREATE TABLE teacher_assignment_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'admin_assigned')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster lookups
DROP INDEX IF EXISTS idx_teacher_requests_student;
DROP INDEX IF EXISTS idx_teacher_requests_teacher;
DROP INDEX IF EXISTS idx_teacher_requests_status;
DROP INDEX IF EXISTS unique_pending_student_teacher;
DROP INDEX IF EXISTS unique_pending_student_no_teacher;

CREATE INDEX idx_teacher_requests_student ON teacher_assignment_requests(student_id);
CREATE INDEX idx_teacher_requests_teacher ON teacher_assignment_requests(teacher_id);
CREATE INDEX idx_teacher_requests_status ON teacher_assignment_requests(status);

-- Unique constraint: Only one pending request per student-teacher pair
-- This allows rejected requests to be re-sent
CREATE UNIQUE INDEX unique_pending_student_teacher 
  ON teacher_assignment_requests(student_id, teacher_id) 
  WHERE status = 'pending' AND teacher_id IS NOT NULL;

-- Only one pending request per student (when teacher not specified)
CREATE UNIQUE INDEX unique_pending_student_no_teacher
  ON teacher_assignment_requests(student_id)
  WHERE status = 'pending' AND teacher_id IS NULL;

-- RLS Policies
ALTER TABLE teacher_assignment_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS student_insert_own_request ON teacher_assignment_requests;
DROP POLICY IF EXISTS student_view_own_request ON teacher_assignment_requests;
DROP POLICY IF EXISTS teacher_view_requests ON teacher_assignment_requests;
DROP POLICY IF EXISTS teacher_update_requests ON teacher_assignment_requests;
DROP POLICY IF EXISTS admin_all_requests ON teacher_assignment_requests;

-- Students can insert their own requests
CREATE POLICY student_insert_own_request ON teacher_assignment_requests
  FOR INSERT
  WITH CHECK (auth.uid() = student_id);

-- Students can view their own requests
CREATE POLICY student_view_own_request ON teacher_assignment_requests
  FOR SELECT
  USING (auth.uid() = student_id);

-- Teachers can view requests sent to them
CREATE POLICY teacher_view_requests ON teacher_assignment_requests
  FOR SELECT
  USING (
    auth.uid() = teacher_id AND 
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
  );

-- Teachers can update requests sent to them (accept/reject)
CREATE POLICY teacher_update_requests ON teacher_assignment_requests
  FOR UPDATE
  USING (
    auth.uid() = teacher_id AND 
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
  );

-- Admins can view/update all requests
CREATE POLICY admin_all_requests ON teacher_assignment_requests
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Trigger to update assigned_teacher when request is accepted or admin assigns
DROP TRIGGER IF EXISTS on_teacher_assignment_accepted ON teacher_assignment_requests;
DROP FUNCTION IF EXISTS handle_teacher_assignment_accepted();

CREATE OR REPLACE FUNCTION handle_teacher_assignment_accepted()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.status = 'accepted' OR NEW.status = 'admin_assigned') AND 
     (OLD.status IS NULL OR (OLD.status != 'accepted' AND OLD.status != 'admin_assigned')) AND
     NEW.teacher_id IS NOT NULL THEN
    -- Update the student's assigned_teacher_id
    UPDATE profiles 
    SET assigned_teacher_id = NEW.teacher_id,
        updated_at = NOW()
    WHERE id = NEW.student_id;
    
    -- Reject all other pending requests from this student
    UPDATE teacher_assignment_requests
    SET status = 'rejected', updated_at = NOW()
    WHERE student_id = NEW.student_id 
      AND id != NEW.id 
      AND status = 'pending';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_teacher_assignment_accepted
  AFTER UPDATE ON teacher_assignment_requests
  FOR EACH ROW
  WHEN (NEW.status = 'accepted' OR NEW.status = 'admin_assigned')
  EXECUTE FUNCTION handle_teacher_assignment_accepted();

COMMENT ON TABLE teacher_assignment_requests IS 'Stores student requests to be assigned to specific teachers';
