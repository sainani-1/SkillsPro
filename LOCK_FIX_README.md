# Account Lock Fix - Step by Step

## What was fixed:
1. ✅ Added `locked_until` timestamp column to track 60-day lock expiration
2. ✅ Updated exam blocking logic to set both `is_locked=true` and `locked_until` timestamp
3. ✅ Added check on exam page load to verify if user is already locked
4. ✅ Added automatic unlock when 60 days have passed
5. ✅ Updated ProtectedRoute to block locked users from accessing any protected pages
6. ✅ Updated database schema to include `locked_until` column

## Steps to Complete:

### Step 1: Update Supabase Database
Run this SQL in Supabase SQL Editor:

```sql
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS locked_until timestamptz;
```

### Step 2: How the Lock Works Now

**When exam rules are violated (3 warnings):**
- `is_locked` → true
- `locked_until` → current date + 60 days
- User is immediately blocked from all pages with "Account Locked" message
- Shows expiration date in Indian format (DD/MM/YYYY)

**After 60 days:**
- Automatic unlock happens next time user tries to access an exam
- System checks: if `locked_until` < now(), set `is_locked = false`
- User can resume normal activity

### Step 3: Test the Lock

1. Take an exam and deliberately trigger 3 warnings (tab switches or fullscreen exits)
2. Exam terminates and account locks for 60 days
3. Try to access courses, other pages → See "Account Locked" message
4. Lock expires after 60 days automatically

## Files Modified:
- `db_schema.sql` - Added `locked_until` column
- `src/pages/Exam.jsx` - Added lock checking and proper timestamp logic
- `src/App.jsx` - Updated ProtectedRoute to enforce lock globally
- `add_locked_until.sql` - Migration file for Supabase

## Important:
The lock now works across the entire platform, not just the exam. Once locked, users cannot access ANY protected pages until the 60-day period expires.
