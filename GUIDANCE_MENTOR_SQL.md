# SQL Migrations - Guidance & Mentor System

Run these in your Supabase SQL Editor to ensure all tables and columns are properly set up.

---

## 1. Create/Update guidance_requests Table

```sql
-- If table doesn't exist, create it
CREATE TABLE IF NOT EXISTS guidance_requests (
  id bigserial primary key,
  student_id uuid references profiles(id) on delete cascade,
  topic text,
  notes text,
  status text default 'pending', -- pending|assigned|scheduled|completed
  assigned_to_teacher_id uuid references profiles(id),
  created_at timestamptz default now(),
  assigned_at timestamptz
);

-- If table exists, add missing columns
ALTER TABLE guidance_requests
ADD COLUMN IF NOT EXISTS student_id uuid references profiles(id) on delete cascade,
ADD COLUMN IF NOT EXISTS assigned_to_teacher_id uuid references profiles(id),
ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

-- Create index for faster teacher lookups
CREATE INDEX IF NOT EXISTS idx_guidance_requests_teacher 
ON guidance_requests(assigned_to_teacher_id);

CREATE INDEX IF NOT EXISTS idx_guidance_requests_student 
ON guidance_requests(student_id);
```

---

## 2. Create guidance_sessions Table

```sql
-- If table doesn't exist, create it
CREATE TABLE IF NOT EXISTS guidance_sessions (
  id bigserial primary key,
  request_id bigint references guidance_requests(id) on delete cascade,
  teacher_id uuid references profiles(id) on delete cascade,
  scheduled_for timestamptz,
  join_link text,
  status text default 'scheduled', -- scheduled|in-progress|completed
  reminder_sent_at timestamptz,
  created_at timestamptz default now()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_guidance_sessions_request 
ON guidance_sessions(request_id);

CREATE INDEX IF NOT EXISTS idx_guidance_sessions_teacher 
ON guidance_sessions(teacher_id);
```

---

## 3. Create/Verify teacher_assignments Table (For Mentor Feature)

```sql
-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS teacher_assignments (
  id bigserial primary key,
  teacher_id uuid references profiles(id) on delete cascade,
  student_id uuid references profiles(id) on delete cascade,
  assigned_by uuid references profiles(id) on delete set null,
  assigned_at timestamptz default now(),
  active boolean default true,
  unique (teacher_id, student_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_teacher 
ON teacher_assignments(teacher_id);

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_student 
ON teacher_assignments(student_id);

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_active 
ON teacher_assignments(active);
```

---

## 4. Data Migration (if migrating from user_id to student_id)

```sql
-- If you have old data in a user_id column, migrate it:
UPDATE guidance_requests 
SET student_id = user_id 
WHERE student_id IS NULL AND user_id IS NOT NULL;

-- Then drop old column (optional, after verification):
ALTER TABLE guidance_requests DROP COLUMN IF EXISTS user_id;
```

---

## 5. Enable Row-Level Security (RLS)

```sql
-- Enable RLS on guidance_requests
ALTER TABLE guidance_requests ENABLE ROW LEVEL SECURITY;

-- Create policy: Students see only their own requests
CREATE POLICY "Students can view own guidance requests" ON guidance_requests
  FOR SELECT
  USING (auth.uid() = student_id OR (
    SELECT role FROM profiles WHERE id = auth.uid()
  ) IN ('admin', 'teacher'));

-- Create policy: Students can insert their own requests
CREATE POLICY "Students can create guidance requests" ON guidance_requests
  FOR INSERT
  WITH CHECK (auth.uid() = student_id);

-- Create policy: Admin and teachers can update
CREATE POLICY "Admin and teachers can update requests" ON guidance_requests
  FOR UPDATE
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'teacher'));

-- Enable RLS on guidance_sessions
ALTER TABLE guidance_sessions ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can see sessions related to their requests
CREATE POLICY "Users can view related sessions" ON guidance_sessions
  FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'teacher') OR
    (SELECT student_id FROM guidance_requests WHERE id = request_id) = auth.uid()
  );

-- Enable RLS on teacher_assignments
ALTER TABLE teacher_assignments ENABLE ROW LEVEL SECURITY;

-- Create policy: Everyone can view active mentor assignments (for mentorship feature)
CREATE POLICY "Everyone can view active assignments" ON teacher_assignments
  FOR SELECT
  USING (active = true);

-- Admin can manage assignments
CREATE POLICY "Admin can manage assignments" ON teacher_assignments
  FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
```

---

## 6. Verify Column Types

```sql
-- Check guidance_requests structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'guidance_requests'
ORDER BY ordinal_position;

-- Check teacher_assignments structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'teacher_assignments'
ORDER BY ordinal_position;

-- Check guidance_sessions structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'guidance_sessions'
ORDER BY ordinal_position;
```

---

## 7. Sample Data (for testing)

```sql
-- Insert test guidance request (if needed)
INSERT INTO guidance_requests (student_id, topic, notes, status)
VALUES (
  'YOUR_STUDENT_UUID_HERE',
  'Career counseling for IT field',
  'Interested in web development',
  'pending'
);

-- View all pending requests
SELECT * FROM guidance_requests WHERE status = 'pending';

-- View all mentor assignments
SELECT 
  ta.id,
  p1.full_name AS student_name,
  p2.full_name AS mentor_name,
  ta.assigned_at,
  ta.active
FROM teacher_assignments ta
JOIN profiles p1 ON ta.student_id = p1.id
JOIN profiles p2 ON ta.teacher_id = p2.id
WHERE ta.active = true;
```

---

## ⚠️ Important Notes

1. **Before running migrations:**
   - Backup your database
   - Test in development environment first
   - Ensure all user roles in `profiles.role` are correct (student/teacher/admin)

2. **RLS Policies:**
   - Replace policies if they already exist (drop and recreate)
   - Test after applying to ensure queries work

3. **Foreign Keys:**
   - Ensure `profiles` table exists with `id` column
   - All user_id references must match UUID format

4. **Permissions:**
   - User running migrations must be Supabase admin
   - RLS policies must allow reads/writes for your app's auth user

---

## ✅ Verification Queries

After running migrations, run these to verify:

```sql
-- Count guidance requests by status
SELECT status, COUNT(*) as count
FROM guidance_requests
GROUP BY status;

-- List all guidance sessions
SELECT 
  gs.id,
  gs.scheduled_for,
  gs.status,
  gs.join_link
FROM guidance_sessions gs
ORDER BY gs.scheduled_for DESC
LIMIT 10;

-- List active mentor assignments
SELECT 
  ta.id,
  (SELECT full_name FROM profiles WHERE id = ta.student_id) AS student,
  (SELECT full_name FROM profiles WHERE id = ta.teacher_id) AS mentor,
  ta.assigned_at
FROM teacher_assignments ta
WHERE ta.active = true
ORDER BY ta.assigned_at DESC;
```

---

## 🚀 Rollback (if needed)

If something goes wrong, you can rollback:

```sql
-- Drop indexes
DROP INDEX IF EXISTS idx_guidance_requests_teacher;
DROP INDEX IF EXISTS idx_guidance_requests_student;
DROP INDEX IF EXISTS idx_guidance_sessions_request;
DROP INDEX IF EXISTS idx_guidance_sessions_teacher;
DROP INDEX IF EXISTS idx_teacher_assignments_teacher;
DROP INDEX IF EXISTS idx_teacher_assignments_student;
DROP INDEX IF EXISTS idx_teacher_assignments_active;

-- Drop tables (WARNING: loses all data)
-- DROP TABLE IF EXISTS guidance_sessions;
-- DROP TABLE IF EXISTS guidance_requests;
-- DROP TABLE IF EXISTS teacher_assignments;
```

---

## 📝 Notes

- All timestamps use `timestamptz` for timezone awareness
- UUIDs for user references (not bigint)
- Cascade deletes: Deleting a profile removes related guidance requests/sessions
- Unique constraint on `teacher_assignments` prevents duplicate mentor assignments per student-teacher pair
