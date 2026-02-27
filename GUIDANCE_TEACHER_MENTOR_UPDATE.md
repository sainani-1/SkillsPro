# Guidance & Mentor System - Updates & Features

## Overview
Complete overhaul of the guidance request system with proper teacher assignment and new mentor assignment feature.

---

## 🎯 Key Fixes Implemented

### 1. **Teacher Panel - Now Shows Only Their Assigned Requests**
**Problem:** Teachers were seeing ALL guidance requests instead of just ones assigned to them.

**Solution:** 
- Modified `loadData()` function to filter requests by `assigned_to_teacher_id` for teachers
- Teachers now see only their own assigned guidance requests in dashboard

**Where it Works:**
- Navigate to Career Guidance → Teacher View
- Shows: "Your Assigned Guidance Requests"
- Only requests where `assigned_to_teacher_id = current_teacher_id`

**What Teachers Can Do:**
- [ ] View guidance requests assigned to them
- [ ] See student ID, topic, and notes
- [ ] Schedule sessions for each request
- [ ] Provide the meeting link to students

---

### 2. **Admin Panel - Improved Request Management**
**Organization:**
1. **Pending Requests** - Students requesting but not yet assigned
2. **Assigned Requests** - Requests assigned to teachers (shows teacher name)
3. **Scheduled Sessions** - Sessions with dates and meeting links

**Admin Actions:**
- Click "Assign Teacher" on pending requests
- Modal shows request topic + student ID
- Select teacher from dropdown
- Teacher automatically notified (will see request in their panel)

---

### 3. **New Feature - Student Mentor Assignment**
**What It Does:**
- Admins can directly assign mentors/teachers to students
- Independent of guidance requests - for ongoing mentorship
- Track all mentor-student relationships in dashboard

**How It Works:**
1. Go to "Career Guidance" page (Admin view)
2. Find "Student Mentors" section
3. Click "Assign Mentor" button
4. Select student + mentor/teacher
5. Click "Assign Mentor"

**What Gets Tracked:**
- Student name
- Assigned mentor
- Who assigned it (admin)
- Assignment date
- Active/Inactive status
- Can remove assignment at any time

**Database:**
- Uses `teacher_assignments` table
- Columns: `teacher_id`, `student_id`, `assigned_by`, `assigned_at`, `active`
- Allows multiple mentors per student (if needed)

---

## 📊 Updated Data Flow

```
STUDENT WORKFLOW:
1. Student submits guidance request
   ↓
2. Admin sees pending request
   ↓
3. Admin assigns a teacher
   ↓
4. Teacher sees request in "Your Assigned Guidance Requests"
   ↓
5. Teacher schedules session with date/time
   ↓
6. Student sees scheduled session in "Guidance Sessions"
   ↓
7. Student clicks join link at scheduled time

MENTOR WORKFLOW:
1. Admin assigns mentor to student
   ↓
2. Mentor listed in student's profile/dashboard
   ↓
3. Student can contact mentor anytime
   ↓
4. Ongoing relationship independent of specific requests
```

---

## 🔄 Component Changes

### GuidanceSessions.jsx

**New State Variables:**
```javascript
- students: [] // All students (for mentor assignment)
- mentors: [] // Active mentor assignments
- showMentorModal: false // Mentor assignment modal visibility
- selectedStudent: null // Student being assigned mentor
- selectedMentor: null // Mentor being assigned
- showSessionModal: false // Session scheduling modal
```

**New Functions:**
```javascript
assignMentor() // Create mentor assignment in teacher_assignments table
```

**Modified Functions:**
```javascript
loadData() {
  // Now filters guidance requests for teachers:
  if (profile.role === 'teacher') {
    .eq('assigned_to_teacher_id', profile.id)
  }
  
  // For admins, fetches:
  - All guidance requests
  - All sessions
  - Available teachers
  - All students (NEW)
  - Active mentor assignments (NEW)
}
```

**New UI Sections:**
```jsx
// For Teachers:
- "Your Assigned Guidance Requests" section
  Shows only their assigned requests

// For Admins:
- "Student Mentors" section with table
  Shows all mentor assignments
  Can add/remove mentors
  Shows status and dates
```

**New Modals:**
- Mentor Assignment Modal
  - Select student dropdown
  - Select mentor dropdown
  - Assign/Cancel buttons

---

## ✅ Testing Checklist

### As a Teacher:
- [ ] Log in as teacher
- [ ] Navigate to Career Guidance page
- [ ] See "Your Assigned Guidance Requests" section
- [ ] Should show only requests assigned to you
- [ ] Click "Schedule Session"
- [ ] Enter date/time (YYYY-MM-DD HH:MM)
- [ ] Get meeting link
- [ ] Request status changes to "scheduled"

### As an Admin:
- [ ] Log in as admin
- [ ] Navigate to Career Guidance page
- [ ] See three sections: Pending, Assigned, Scheduled
- [ ] Click "Assign Teacher" on pending request
- [ ] Modal opens with topic and student ID
- [ ] Select a teacher
- [ ] Click "Assign"
- [ ] Request moves to "Assigned Requests"
- [ ] Teacher's name shows in assigned section
- [ ] Find "Student Mentors" section
- [ ] Click "Assign Mentor"
- [ ] Select student + mentor
- [ ] Click "Assign Mentor"
- [ ] See assignment in table
- [ ] Try "Remove" button to deactivate

### As a Student:
- [ ] Log in as student
- [ ] Navigate to Career Guidance page
- [ ] Submit guidance request (Topic + Notes)
- [ ] See request in "Your Guidance Requests" section
- [ ] Status shows as "pending"
- [ ] When admin assigns teacher, status changes to "assigned"
- [ ] When teacher schedules session, status changes to "scheduled"
- [ ] See scheduled session with date/time + join link
- [ ] Can click link to join the session

---

## 🐛 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Teacher doesn't see their assigned requests | Verify admin properly assigned teacher (check `assigned_to_teacher_id` in DB) |
| Can't see "Student Mentors" section | Make sure you're logged in as admin |
| Error "Select a student and mentor" | Both dropdowns must have selections |
| Mentor assignment shows but not active | Check that `active = true` in `teacher_assignments` table |
| Teacher can't schedule session | Request must have `status = 'assigned'` first |

---

## 📋 Database Schema Used

**guidance_requests table:**
- `id` (primary key)
- `student_id` (references profiles)
- `topic` (text)
- `notes` (text)
- `status` (pending/assigned/scheduled/completed)
- `assigned_to_teacher_id` (references profiles) ← Used by teachers to see their requests
- `assigned_at` (timestamp)
- `created_at` (timestamp)

**teacher_assignments table:** (For Mentor Feature)
- `id` (primary key)
- `teacher_id` (references profiles)
- `student_id` (references profiles)
- `assigned_by` (references profiles) ← Admin who created assignment
- `assigned_at` (timestamp)
- `active` (boolean) ← Can deactivate instead of delete

**guidance_sessions table:**
- `id` (primary key)
- `request_id` (references guidance_requests)
- `teacher_id` (references profiles)
- `scheduled_for` (timestamp)
- `join_link` (text - auto-generated meeting URL)
- `status` (scheduled/completed)
- `created_at` (timestamp)

---

## 🚀 Next Steps

1. ✅ Run all tests from checklist above
2. ✅ Verify teacher sees only their assigned requests (not all)
3. ✅ Test mentor assignment feature for admins
4. ✅ Check database for correct data in teacher_assignments
5. [ ] (Optional) Add email notifications when:
   - Admin assigns teacher to guidance request
   - Teacher gets assigned as mentor
   - Session is scheduled
6. [ ] (Optional) Add "My Mentor" section to student dashboard
7. [ ] (Optional) Add mentor chat/messaging system

---

## ✨ Key Improvements Summary

- ✅ Teachers now see only THEIR assigned requests (not everyone's)
- ✅ Admin sees all requests organized by status
- ✅ New mentor assignment system for ongoing mentorship
- ✅ Better error handling with detailed messages
- ✅ Proper role-based access control
- ✅ Clean UI with status indicators and timestamps
