# Teacher Assignment Request System - Fix Applied

## Issue Fixed
Column name mismatch: The database schema uses `assigned_teacher_id` but some code was using `assigned_teacher`, causing errors when teachers were assigned.

## Files Updated

### 1. migration_add_assigned_teacher.sql
- Changed column name from `assigned_teacher` to `assigned_teacher_id`
- Ensures the column exists in profiles table (if not already present)
- Creates index on `assigned_teacher_id` for performance

### 2. migration_teacher_assignment_requests.sql  
- Fixed trigger function `handle_teacher_assignment_accepted()`
- Now correctly updates `profiles.assigned_teacher_id` instead of `profiles.assigned_teacher`
- Trigger fires when teacher accepts request OR admin assigns teacher

### 3. src/pages/RequestTeacher.jsx
- Updated all 4 references from `profile?.assigned_teacher` to `profile?.assigned_teacher_id`
- Lines updated: 85, 166, 174, 288

## How to Apply

Run these migrations in Supabase SQL Editor in this order:

1. **First** - Run `migration_add_assigned_teacher.sql`
   ```sql
   -- Ensures assigned_teacher_id column exists
   ```

2. **Second** - Run `migration_teacher_assignment_requests.sql`
   ```sql
   -- Creates teacher_assignment_requests table with fixed trigger
   ```

3. **Third** - Run `migration_settings_table.sql` (if not already done)
   ```sql
   -- Creates settings table for platform configuration
   ```

## How It Works

1. **Student requests teacher:**
   - Can select specific teacher OR request admin assignment (no teacher specified)
   - If already has `assigned_teacher_id`, cannot request another

2. **Teacher accepts request:**
   - Status changes to 'accepted'
   - Trigger updates student's `assigned_teacher_id`
   - All other pending requests from that student are auto-rejected

3. **Admin assigns teacher:**
   - Can assign via `/app/admin/teacher-requests`
   - Status changes to 'admin_assigned'  
   - Same trigger updates student's `assigned_teacher_id`

## Verified Consistency

All components now use `assigned_teacher_id`:
- ✅ RequestTeacher.jsx
- ✅ ChatWithTeacher.jsx
- ✅ TeacherAssignment.jsx
- ✅ AdminTeacherRequests.jsx
- ✅ TeacherRequests.jsx
- ✅ Database trigger function

## Test After Migration

1. Create a test student account
2. Go to Request Teacher page
3. Send request to a teacher (or request admin assignment)
4. Accept as teacher OR assign as admin
5. Verify student's `assigned_teacher_id` is updated
6. Verify student sees "You already have a teacher assigned" message
7. Verify student cannot send more requests
