# Guidance Request System - Testing Guide

## Quick Verification Checklist

### 1. **Student: Submit Guidance Request**
- [ ] Log in as student
- [ ] Navigate to "Career Guidance" page
- [ ] Click "Request Guidance Webinar"
- [ ] Fill in:
  - Topic: (e.g., "Career counseling for IT field")
  - Notes: (optional)
- [ ] Click "Submit Request"
- [ ] **Expected:** Alert says "Request submitted! Admin will assign a teacher soon."
- [ ] **Check Console:** Look for any error messages if it fails
- [ ] **Database:** Check `guidance_requests` table - new row should appear with:
  - `student_id`: (your user ID)
  - `topic`: (what you entered)
  - `status`: 'pending'
  - `assigned_to_teacher_id`: NULL

---

### 2. **Admin: View Pending Requests**
- [ ] Log in as admin
- [ ] Navigate to "Career Guidance" or create a guidance page for admin
- [ ] OR: Go to GuidanceSessions (if admin access enabled)
- [ ] **Expected:** See section "Pending Requests (X)" with:
  - Topic you just submitted
  - Student ID (not student name, since we simplified data fetch)
  - "Assign Teacher" button
- [ ] **If not showing:**
  - Open browser DevTools (F12)
  - Check Console tab for error messages
  - Common errors:
    - "Error loading requests: permission denied" → RLS policy issue
    - "Error loading requests: relation guidance_requests does not exist" → Database schema issue
    - Any other error will now be visible instead of silently failing

---

### 3. **Admin: Assign Teacher**
- [ ] Click "Assign Teacher" button next to pending request
- [ ] Modal should open showing:
  - Topic of the request
  - Student ID
  - Dropdown to select a teacher
- [ ] Select a teacher from dropdown
- [ ] Click "Assign"
- [ ] **Expected:** 
  - Alert: "Teacher assigned successfully!"
  - Request moves from "Pending Requests" to "Assigned Requests"
  - Status in database: `status` = 'assigned', `assigned_to_teacher_id` = teacher's ID

---

### 4. **Teacher: View Assigned Requests**
- [ ] Log in as teacher
- [ ] Navigate to "Career Guidance"
- [ ] Look for section "Requests Assigned to You"
- [ ] **Expected:** See the request that was assigned with:
  - Topic
  - Student ID
  - "Schedule Session" button
- [ ] **If not showing:**
  - Check if profile.role = 'teacher'
  - Check if guidance_requests with matching assigned_to_teacher_id exist

---

### 5. **Teacher: Schedule Session**
- [ ] Click "Schedule Session" on assigned request
- [ ] Prompt asks: "Enter date and time (YYYY-MM-DD HH:MM):"
- [ ] Enter date like: `2024-02-15 14:30`
- [ ] **Expected:**
  - Alert with meeting link: `https://meet.stepwithnani.com/session/xxxxx`
  - Request status changes to 'scheduled'
  - Row appears in `guidance_sessions` table with:
    - `request_id`: (the request ID)
    - `teacher_id`: (your teacher ID)
    - `scheduled_for`: (date you entered)
    - `join_link`: (the generated link)
    - `status`: 'scheduled'

---

### 6. **Student: View Scheduled Session**
- [ ] Log in as student (same one who made the request)
- [ ] Go to "Career Guidance"
- [ ] In "Your Guidance Requests" section
- [ ] **Expected:** Request now shows:
  - Topic
  - Status badge showing it's "scheduled" or assigned
  - Assigned teacher ID
  - (Optional) Join link or "Attend Session" button

---

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Request doesn't appear in admin panel | Data not saved / Query failed | Check browser console for error message, verify Supabase RLS policies allow admin to read guidance_requests |
| "Error loading requests: ..." shows in alert | Supabase query error | Check RLS policies, verify guidance_requests table exists, check column names (student_id not user_id) |
| Admin panel says "Pending Requests (0)" but student submitted | Student ID mismatch | Verify submitted request has correct student_id in DB |
| Dropdown has no teachers | No teacher profiles exist | Create teacher profile with role='teacher' in profiles table |
| "Error assigning teacher" alert | RLS policy or update failed | Check if admin can update guidance_requests, verify teacher_id is valid |

---

## Database Schema Verification

Before testing, verify these columns exist:

**`guidance_requests` table:**
```
id (uuid) - primary key
student_id (uuid) - references profiles(id)
topic (text) - required
notes (text) - optional
status (text) - 'pending', 'assigned', 'scheduled', 'completed'
assigned_to_teacher_id (uuid) - references profiles(id), can be NULL
assigned_at (timestamp) - when teacher was assigned
created_at (timestamp) - when request was created
```

**`guidance_sessions` table:**
```
id (uuid) - primary key
request_id (uuid) - references guidance_requests(id)
teacher_id (uuid) - references profiles(id)
scheduled_for (timestamp) - when session happens
join_link (text) - meeting URL
status (text) - 'scheduled', 'in-progress', 'completed'
created_at (timestamp)
```

**`profiles` table:**
```
id (uuid) - primary key
role (text) - 'student', 'teacher', 'admin'
full_name (text)
email (text)
```

---

## Error Messages Now Show Actual Details

Thanks to improved error handling:
- If submission fails: See exact Supabase error
- If admin fetch fails: See what's wrong with the query
- If assignment fails: See if it's permissions, validation, or connection issue
- All errors logged to browser console + shown in alert

Check your browser console (F12 → Console tab) for detailed error messages!

---

## Next Steps

1. ✅ Run through all 6 verification steps
2. ✅ Check browser console for any errors
3. ✅ Share any error messages that appear
4. ✅ Verify database has the new columns and data is being saved
5. ✅ Once working, system is ready for production!
