# Quick Start Checklist - Guidance & Mentor System

## ✅ Pre-Deployment Checklist

### Code Changes
- [x] GuidanceSessions.jsx updated with:
  - [x] New state variables for students, mentors, modals
  - [x] Modified loadData() to filter teacher requests
  - [x] New assignMentor() function
  - [x] Teacher-only section for assigned requests
  - [x] Admin mentor management section
  - [x] Mentor assignment modal
  - [x] No compilation errors

### Documentation Created
- [x] GUIDANCE_TEACHER_MENTOR_UPDATE.md - Feature overview
- [x] GUIDANCE_MENTOR_SQL.md - Database migrations
- [x] GUIDANCE_TEACHER_MENTOR_FINAL.md - Quick summary
- [x] SYSTEM_ARCHITECTURE.md - Detailed diagrams
- [x] This checklist

---

## 📋 Database Setup

### ⚠️ REQUIRED: Run These SQL Migrations

```sql
-- Copy & paste in Supabase SQL Editor

-- 1. Create/update guidance_requests
CREATE TABLE IF NOT EXISTS guidance_requests (
  id bigserial primary key,
  student_id uuid references profiles(id) on delete cascade,
  topic text,
  notes text,
  status text default 'pending',
  assigned_to_teacher_id uuid references profiles(id),
  created_at timestamptz default now(),
  assigned_at timestamptz
);

-- 2. Create guidance_sessions
CREATE TABLE IF NOT EXISTS guidance_sessions (
  id bigserial primary key,
  request_id bigint references guidance_requests(id) on delete cascade,
  teacher_id uuid references profiles(id) on delete cascade,
  scheduled_for timestamptz,
  join_link text,
  status text default 'scheduled',
  reminder_sent_at timestamptz,
  created_at timestamptz default now()
);

-- 3. Verify teacher_assignments exists
CREATE TABLE IF NOT EXISTS teacher_assignments (
  id bigserial primary key,
  teacher_id uuid references profiles(id) on delete cascade,
  student_id uuid references profiles(id) on delete cascade,
  assigned_by uuid references profiles(id) on delete set null,
  assigned_at timestamptz default now(),
  active boolean default true,
  unique (teacher_id, student_id)
);

-- 4. Create indexes (improves performance)
CREATE INDEX IF NOT EXISTS idx_guidance_requests_teacher 
ON guidance_requests(assigned_to_teacher_id);

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_active 
ON teacher_assignments(active);
```

### Verify Database
```sql
-- Run these to verify tables exist

-- Check guidance_requests columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'guidance_requests';

-- Check teacher_assignments
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'teacher_assignments';

-- Check data exists
SELECT COUNT(*) as request_count FROM guidance_requests;
SELECT COUNT(*) as mentor_count FROM teacher_assignments WHERE active = true;
```

---

## 🧪 Testing Sequence

### Test 1: Student Submits Request
- [ ] Log in as STUDENT
- [ ] Navigate to "Career Guidance" page
- [ ] Enter Topic: "Career guidance for IT field"
- [ ] Enter Notes: "Want to learn web development"
- [ ] Click "Submit Request"
- [ ] Alert: "Request submitted! Admin will assign a teacher soon."
- [ ] Check "Your Guidance Requests" section
- [ ] Request appears with status "Pending"

**Expected Result:** ✅ Request stored in database with `status = 'pending'`

---

### Test 2: Admin Assigns Teacher
- [ ] Log out, log in as ADMIN
- [ ] Navigate to "Career Guidance" page
- [ ] Find "Pending Requests (1)" section
- [ ] See the student's request you just created
- [ ] Click "Assign Teacher" button
- [ ] Modal opens showing:
  - [x] Topic of request
  - [x] Student ID
  - [x] Teacher dropdown
- [ ] Select a teacher from dropdown
- [ ] Click "Assign" button
- [ ] Alert: "Teacher assigned successfully!"
- [ ] Request disappears from "Pending Requests"
- [ ] Request appears in "Assigned Requests" section
- [ ] Shows teacher name and assignment date

**Expected Result:** ✅ Request moved to `status = 'assigned'` with `assigned_to_teacher_id` set

---

### Test 3: Teacher Sees Their Request
- [ ] Log out, log in as the TEACHER you assigned
- [ ] Navigate to "Career Guidance" page
- [ ] Look for "Your Assigned Guidance Requests" section
- [ ] See the request assigned to you
- [ ] Shows:
  - [x] Topic from student
  - [x] Student ID
  - [x] Notes from student
  - [x] Status: "Assigned"
- [ ] ⚠️ Should NOT show requests assigned to OTHER teachers

**Expected Result:** ✅ Teacher sees ONLY their assigned requests (filtered by `assigned_to_teacher_id = my_id`)

---

### Test 4: Teacher Schedules Session
- [ ] Still logged in as TEACHER
- [ ] Click "Schedule Session" button on the request
- [ ] Prompt: "Enter date and time (YYYY-MM-DD HH:MM):"
- [ ] Enter: `2024-02-15 14:30`
- [ ] Press OK
- [ ] Alert: "Session scheduled! Link: https://meet.stepwithnani.com/session/xxxxx"
- [ ] Request status changes to "Scheduled"
- [ ] Session appears in "Scheduled Sessions" section with:
  - [x] Date/time you entered
  - [x] Join link (clickable)

**Expected Result:** ✅ Entry created in `guidance_sessions` with `status = 'scheduled'`

---

### Test 5: Student Sees Scheduled Session
- [ ] Log out, log in as STUDENT (who submitted original request)
- [ ] Navigate to "Career Guidance" page
- [ ] In "Your Guidance Requests" section:
  - [x] Request now shows status: "Scheduled"
  - [x] Shows "Assigned to Teacher ID: [id]"
- [ ] In "Scheduled Guidance Sessions" section:
  - [x] Session appears with date/time
  - [x] Join link is clickable
  - [x] Can click "Join" to attend

**Expected Result:** ✅ Student can see scheduled session with join link

---

### Test 6: Admin Assigns Mentor (NEW FEATURE)
- [ ] Log in as ADMIN
- [ ] Navigate to "Career Guidance" page
- [ ] Scroll down to "Student Mentors" section
- [ ] Click "Assign Mentor" button (with ➕ icon)
- [ ] Modal opens with:
  - [x] "Select Student" dropdown
  - [x] "Select Mentor (Teacher)" dropdown
- [ ] Select a student
- [ ] Select a teacher to be mentor
- [ ] Click "Assign Mentor" button
- [ ] Alert: "Mentor assigned successfully!"
- [ ] Modal closes
- [ ] Entry appears in "Student Mentors" table showing:
  - [x] Student name
  - [x] Mentor name
  - [x] Assignment date
  - [x] Status: "Active"
  - [x] "Remove" button

**Expected Result:** ✅ Entry created in `teacher_assignments` with `active = true`

---

### Test 7: Remove Mentor Assignment
- [ ] Still logged in as ADMIN
- [ ] In "Student Mentors" table
- [ ] Click "Remove" button on a mentor assignment
- [ ] Confirm/success
- [ ] Entry should disappear from table (or show as Inactive)

**Expected Result:** ✅ Assignment marked as `active = false`

---

## 🔍 Troubleshooting

### Issue: Teacher sees all requests, not just theirs
**Cause:** Database doesn't have `assigned_to_teacher_id` column
**Fix:** Run SQL migration to add column

### Issue: Can't see "Student Mentors" section
**Cause:** Not logged in as admin
**Fix:** Verify you're logged in with admin role

### Issue: Dropdown shows "No teachers" or "No students"
**Cause:** No teacher/student profiles exist in database
**Fix:** Create test profiles with correct roles

### Issue: "Error assigning teacher: permission denied"
**Cause:** Row-Level Security (RLS) policy blocking query
**Fix:** Check RLS policies in Supabase → Table details

### Issue: "Could not find the 'student_id' column"
**Cause:** Database migration not run yet
**Fix:** Run the SQL migration for guidance_requests table

### Issue: Mentor assignment shows but marked as Inactive
**Cause:** The `active` field set to false
**Fix:** Delete and recreate, or update `active = true` in database

---

## ✅ Final Verification

Run these queries in Supabase to verify everything:

```sql
-- Check guidance requests exist
SELECT id, student_id, topic, status, assigned_to_teacher_id 
FROM guidance_requests 
LIMIT 5;

-- Check guidance sessions created
SELECT id, request_id, teacher_id, scheduled_for, join_link 
FROM guidance_sessions 
LIMIT 5;

-- Check mentor assignments
SELECT id, student_id, teacher_id, assigned_at, active 
FROM teacher_assignments 
WHERE active = true 
LIMIT 5;

-- Count by status (should show pending, assigned, scheduled)
SELECT status, COUNT(*) as count 
FROM guidance_requests 
GROUP BY status;
```

---

## 📦 Deployment Steps

1. **✅ Code deployed** - GuidanceSessions.jsx with no errors
2. **⚠️ Database** - Run SQL migrations from [GUIDANCE_MENTOR_SQL.md](GUIDANCE_MENTOR_SQL.md)
3. **🧪 Test** - Run through all 7 test scenarios above
4. **✅ Verify** - Run verification queries above
5. **🚀 Go Live** - Open to users

---

## 📞 Support Commands

**If something breaks, check:**

1. **Browser Console** (F12 → Console)
   - Look for red error messages
   - Share any Supabase errors

2. **Supabase Logs**
   - Go to Supabase → SQL Editor → Run queries to check data

3. **Check Profiles**
   ```sql
   SELECT id, full_name, role FROM profiles LIMIT 10;
   ```

4. **Check Requests**
   ```sql
   SELECT * FROM guidance_requests WHERE status = 'pending' LIMIT 5;
   ```

5. **Check Mentors**
   ```sql
   SELECT * FROM teacher_assignments WHERE active = true LIMIT 5;
   ```

---

## 🎯 Success Criteria

- [x] Code compiles without errors
- [ ] Student can submit guidance request
- [ ] Admin can see and assign teacher
- [ ] Teacher sees ONLY their assigned requests
- [ ] Teacher can schedule sessions
- [ ] Student sees scheduled sessions with join link
- [ ] Admin can assign mentors to students
- [ ] Mentor assignments appear in table
- [ ] All data persists in database

---

**Status:** Ready for Database Setup → Testing → Go Live ✅
