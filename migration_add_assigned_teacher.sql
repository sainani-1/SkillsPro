-- Add assigned_teacher_id column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS assigned_teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_assigned_teacher_id ON profiles(assigned_teacher_id);

-- Add comment
COMMENT ON COLUMN profiles.assigned_teacher_id IS 'The teacher assigned to this student';
