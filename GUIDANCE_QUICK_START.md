# Guidance System - Quick Start Guide

## 🎯 Complete User Journey

### For Students
```
1. Go to Career Guidance page
2. Click "Request Guidance" button
3. Opens GuidanceSessions page
4. Fill topic: "Career path in web development"
5. Add notes (optional)
6. Click "Submit Request"
7. Status shows "Pending" - admin will review
8. Once admin assigns teacher:
   - Shows "Assigned Teacher: [Name]"
   - "Teacher will schedule the session with you"
9. Once teacher schedules:
   - Appears in "Your Scheduled Sessions"
   - Shows date, time, and "Join" button
10. Click "Join" to attend meeting
```

### For Admin/Teacher
```
1. Go to GuidanceSessions (/app/guidance-sessions)
2. See all pending requests
3. Click "Assign Teacher" on any request
4. Select teacher from dropdown
5. Click "Assign"
6. Request moves to "Assigned Requests"
7. Teacher can now click "Schedule Session"
8. Enter date/time
9. Session is scheduled
10. Both teacher and student can "Join" the meeting
```

---

## 📊 Status Journey

```
┌─────────────┐
│  Pending    │  (Yellow badge) - Just submitted
└──────┬──────┘
       ↓
┌─────────────┐
│  Assigned   │  (Blue badge) - Teacher assigned, waiting to schedule
└──────┬──────┘
       ↓
┌─────────────┐
│ Scheduled   │  (Purple badge) - Meeting scheduled, student can join
└──────┬──────┘
       ↓
┌─────────────┐
│ Completed   │  (Green badge) - Session happened
└─────────────┘
```

---

## 🔑 Key Features

### ✅ Student Side
- ✅ Submit guidance requests with topic + notes
- ✅ View all request history with status
- ✅ See assigned teacher info
- ✅ View all scheduled sessions
- ✅ Join meeting directly from dashboard

### ✅ Teacher Side  
- ✅ See all guidance requests assigned to you
- ✅ Schedule sessions for assigned requests
- ✅ Generate unique meeting links
- ✅ View all scheduled sessions
- ✅ Quick access from Career Guidance page

### ✅ Admin Side
- ✅ View all pending guidance requests
- ✅ Assign teachers to requests
- ✅ See all assigned requests
- ✅ Monitor all scheduled sessions
- ✅ Modal for easy teacher assignment

---

## 📍 Page Routes

| Page | Route | Users |
|------|-------|-------|
| Career Guidance | `/app/career-guidance` | All (Premium) |
| Guidance Sessions | `/app/guidance-sessions` | All (Premium) |

**Actions:**
- Career Guidance page has "Request Guidance" button → links to GuidanceSessions

---

## 📱 UI Elements

### Status Badges
```
Pending  → Yellow background, yellow text
Assigned → Blue background, blue text  
Scheduled → Purple background, purple text
Completed → Green background, green text
```

### Sections on GuidanceSessions Page

**Student View:**
1. Request Form (always available)
2. Your Requests (history with status)
3. Your Scheduled Sessions (with join links)

**Admin/Teacher View:**
1. Pending Requests (blue "Assign Teacher" button)
2. Assigned Requests (green "Schedule Session" button)
3. Scheduled Sessions (view all)
4. Teacher Assignment Modal (appears when needed)

---

## 🔄 Data Flow

```
Student
  │
  ├─→ Submit Request
  │    └─→ Creates guidance_requests record
  │        (status: pending, assigned_to_teacher_id: null)
  │
  └─→ Wait for Admin Action
       │
       └─→ Admin Assigns Teacher
            └─→ Updates guidance_requests
                (status: assigned, assigned_to_teacher_id: [teacher_id])
                
                │
                └─→ Teacher Schedules Session
                     └─→ Creates guidance_sessions record
                     └─→ Updates guidance_requests
                         (status: scheduled)
                         
                         │
                         └─→ Student Joins Meeting
                             └─→ Attends session
                             └─→ Updates guidance_sessions
                                 (status: completed)
```

---

## 🗄️ Database Tables

### guidance_requests
- `id` - Request ID
- `student_id` - Who requested
- `topic` - What they asked about
- `notes` - Additional context
- `status` - Current state (pending/assigned/scheduled/completed)
- `assigned_to_teacher_id` - Which teacher (null until assigned)
- `created_at` - When submitted
- `assigned_at` - When teacher assigned

### guidance_sessions
- `id` - Session ID
- `request_id` - Links to guidance_requests
- `teacher_id` - Teacher conducting session
- `scheduled_for` - Meeting date/time
- `join_link` - Meeting URL
- `status` - scheduled or completed
- `created_at` - When session created

---

## 🎬 Step-by-Step Admin Assignment

```
Admin Dashboard
    ↓
    Opens GuidanceSessions (/app/guidance-sessions)
    ↓
    Sees "Pending Requests" section
    ↓
    Request Card shows:
    - Topic: "Career path..."
    - Student: "John Doe (john@email.com)"
    - Date: "Jan 5, 2025"
    - [Assign Teacher] Button
    ↓
    Clicks [Assign Teacher]
    ↓
    Modal Appears:
    - Title: "Assign Teacher"
    - Shows: Topic + Student name
    - Dropdown: "-- Choose a teacher --"
    - Teacher options list displayed
    ↓
    Select "Rahul Kumar" from dropdown
    ↓
    Click [Assign] button
    ↓
    ✓ Success: "Teacher assigned successfully!"
    ↓
    Page refreshes:
    - Request moves to "Assigned Requests" section
    - Now shows:
      - Topic
      - Student name
      - Teacher: Rahul Kumar
      - [Schedule Session] Button
    ↓
    Teacher sees:
    - On CareerGuidance page: "Requests Assigned to You"
    - On GuidanceSessions: "Assigned Requests" section
```

---

## ⏱️ Timeline Example

```
Jan 5, 10:00 AM
└─ Student submits request "Web dev career path"
   └─ Status: Pending (Yellow)

Jan 5, 2:00 PM
└─ Admin assigns "Rahul Kumar" as teacher
   └─ Status: Assigned (Blue)
   └─ Rahul sees request assigned to him

Jan 5, 3:30 PM
└─ Rahul schedules session for Jan 15, 2:30 PM
   └─ Status: Scheduled (Purple)
   └─ Student sees scheduled session
   └─ Meeting link generated

Jan 15, 2:30 PM
└─ Student clicks "Join"
   └─ Opens meeting with Rahul
   └─ Session happens

After Session
└─ Status: Completed (Green)
   └─ Both can reference meeting later
```

---

## 🔗 Important Links

### Files Modified
- `db_schema.sql` - Updated guidance tables
- `src/pages/GuidanceSessions.jsx` - Main page (rewritten)
- `src/pages/CareerGuidance.jsx` - Added request button + teacher requests section
- `GUIDANCE_SYSTEM.md` - Full documentation

### Route Points
- Student submits → `/app/guidance-sessions`
- Admin manages → `/app/guidance-sessions`
- Teacher manages → `/app/guidance-sessions` + `/app/career-guidance`

---

## ✨ What's New vs Old

| Feature | Old | New |
|---------|-----|-----|
| Student Request | ✅ Form exists | ✅ Form + history display |
| Request History | ❌ Not shown | ✅ Shows all requests + status |
| Admin Assignment | ❌ Not possible | ✅ Modal popup, select teacher |
| Teacher Assignment | Manual | Automated with modal |
| Teacher View | Placeholder | ✅ Full dashboard with requests |
| Status Tracking | Manual | ✅ Auto-updated |
| Join Links | Generate on schedule | ✅ Generate on schedule |
| Student Visibility | ❌ Can't see assigned teacher | ✅ Shows teacher card when assigned |

---

## 🚀 Testing Checklist

- [ ] Student can submit request
- [ ] Request appears in student's history as "Pending"
- [ ] Admin can see pending request
- [ ] Admin can click "Assign Teacher"
- [ ] Modal shows up with teacher dropdown
- [ ] Selecting teacher and clicking assign works
- [ ] Request status changes to "Assigned" in admin view
- [ ] Student sees "Assigned Teacher: [Name]" card
- [ ] Teacher sees request in "Requests Assigned to You"
- [ ] Teacher can schedule session
- [ ] Date/time input works
- [ ] Session appears in "Scheduled Sessions"
- [ ] Student can see scheduled session
- [ ] Join link works for both
- [ ] Request status changes to "Scheduled"

---

## 📞 Support

If student says: "I can't see my guidance request"
→ Check: Student dashboard shows requests in GuidanceSessions page

If admin says: "Can't assign teacher"
→ Check: Teachers table has records with role='teacher'

If session link doesn't work:
→ Check: URL format and browser compatibility

