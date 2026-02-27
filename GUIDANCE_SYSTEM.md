# Guidance Request & Session Management System

## Overview
Complete system for students to request career guidance, admins to assign teachers, and teachers to schedule sessions with students.

## Database Schema

### guidance_requests Table
```sql
create table if not exists guidance_requests (
  id bigserial primary key,
  student_id uuid references profiles(id) on delete cascade,
  topic text,
  notes text,
  status text default 'pending', -- pending|assigned|scheduled|completed
  assigned_to_teacher_id uuid references profiles(id),
  created_at timestamptz default now(),
  assigned_at timestamptz
);
```

**Fields:**
- `student_id`: Foreign key to student who requested guidance
- `topic`: Main topic/question for guidance
- `notes`: Additional context/details
- `status`: Current state of request (see flow below)
- `assigned_to_teacher_id`: Teacher assigned to handle this request
- `created_at`: When request was submitted
- `assigned_at`: When teacher was assigned

### guidance_sessions Table
```sql
create table if not exists guidance_sessions (
  id bigserial primary key,
  request_id bigint references guidance_requests(id) on delete cascade,
  teacher_id uuid references profiles(id),
  scheduled_for timestamptz,
  join_link text,
  status text default 'scheduled', -- scheduled|completed
  reminder_sent_at timestamptz,
  created_at timestamptz default now()
);
```

**Fields:**
- `request_id`: Links to guidance_requests
- `teacher_id`: Teacher conducting the session
- `scheduled_for`: Date/time of the session
- `join_link`: Meeting URL for the session
- `status`: scheduled or completed
- `reminder_sent_at`: Tracks if reminder was sent

---

## User Flows

### Flow 1: Student Requests Guidance
```
1. Student opens /app/guidance-sessions
2. Fills in:
   - Topic: "Career path in web development"
   - Notes: Optional context about their situation
3. Clicks "Submit Request"
4. Request created with status="pending"
5. Admin sees it in GuidanceSessions pending requests
6. Student sees request in "Your Requests" with status: "pending"
```

**Student Dashboard Display:**
- Status badge: Yellow "Pending"
- Message: "Admin will assign a teacher soon"
- No teacher info yet

---

### Flow 2: Admin Assigns Teacher
```
1. Admin opens /app/guidance-sessions
2. Views "Pending Requests" section
3. Finds request: "Career path in web development" by Student Name
4. Clicks "Assign Teacher"
5. Modal opens with dropdown of available teachers
6. Selects teacher (e.g., "Rahul Kumar")
7. Clicks "Assign"
8. Status changed to "assigned"
9. assigned_to_teacher_id set to selected teacher
10. assigned_at timestamp recorded
```

**Database Change:**
```
status: "pending" → "assigned"
assigned_to_teacher_id: NULL → [teacher_uuid]
assigned_at: NULL → NOW()
```

**Student Sees:**
- Status badge: Blue "Assigned"
- Teacher card: "Assigned Teacher: Rahul Kumar"
- Message: "Teacher will schedule the session with you"

**Admin/Teacher Sees:**
- Request moves to "Assigned Requests" section
- Shows "Schedule Session" button

---

### Flow 3: Teacher Schedules Session
```
1. Teacher opens /app/guidance-sessions
2. Views "Assigned Requests" section
3. Finds assigned request
4. Clicks "Schedule Session"
5. Prompted to enter date/time: "2025-01-15 14:30"
6. System generates unique join link
7. Session created with:
   - scheduled_for: [date_time]
   - join_link: https://meet.stepwithnani.com/session/[random]
   - status: "scheduled"
8. guidance_requests status changed to "scheduled"
```

**Validation:**
- Date/time must be in valid format
- Must be in future

---

### Flow 4: Student Attends Session
```
1. Student goes to /app/guidance-sessions
2. Sees "Your Scheduled Sessions" section
3. Views session details:
   - Teacher name
   - Date & time
   - "Join" button
4. Clicks "Join" button
5. Opens meeting link in new tab
6. Attends session
7. After session, teacher marks as completed
```

**Display on Dashboard:**
- Session card with calendar icon
- Teacher name: "Session with Rahul Kumar"
- Date/Time: "Jan 15, 2025 2:30 PM"
- "Join" button → opens meeting URL

---

## Components & Pages

### GuidanceSessions.jsx (`/app/guidance-sessions`)

**For Students:**
1. **Request Form Section**
   - Input: Topic (required)
   - Input: Notes (optional)
   - Button: "Submit Request"

2. **Your Requests History Section**
   - List of all requests with status badges
   - Shows: topic, date, status, notes
   - If assigned, shows teacher card with teacher name
   - Color-coded by status:
     - Yellow: pending
     - Blue: assigned
     - Purple: scheduled
     - Green: completed

3. **Your Scheduled Sessions Section**
   - List of scheduled sessions for this student
   - Shows: teacher name, date/time, join link
   - "Join" button for each session

**For Admin/Teacher:**
1. **Pending Requests Section**
   - Shows all unassigned requests
   - Card for each request shows:
     - Topic
     - Student name & email
     - Request date
     - "Assign Teacher" button

2. **Assigned Requests Section**
   - Shows requests with assigned teachers
   - Shows: topic, student name, assigned teacher, assigned date
   - "Schedule Session" button for each

3. **Scheduled Sessions Section**
   - All scheduled sessions across platform
   - Shows: teacher name, scheduled date/time, join link
   - "Join Link" button to copy/access

4. **Teacher Assignment Modal**
   - Triggered by "Assign Teacher" button
   - Shows request topic and student name
   - Dropdown to select teacher from available teachers
   - "Assign" and "Cancel" buttons

---

## CareerGuidance.jsx Enhancement

Added new section for teachers: **"Requests Assigned to You"**

**Shows:**
- All guidance requests assigned to current teacher
- Card for each request:
  - Topic
  - Student name
  - Request date
  - Status badge
  - Link to GuidanceSessions page

**Also updated navigation:**
- "Request Guidance" button now links to `/app/guidance-sessions`
- Instead of static "Get personalized plan" button

---

## API Queries

### Get Student's Requests (with assigned teacher)
```javascript
const { data } = await supabase
  .from('guidance_requests')
  .select(`
    id,
    topic,
    notes,
    status,
    created_at,
    assigned_to_teacher_id,
    assigned_at,
    teacher:assigned_to_teacher_id(full_name, avatar_url)
  `)
  .eq('student_id', studentId)
  .order('created_at', { ascending: false });
```

### Get Pending Requests for Admin (with student info)
```javascript
const { data } = await supabase
  .from('guidance_requests')
  .select(`
    id,
    topic,
    notes,
    status,
    created_at,
    student_id,
    student:student_id(full_name, email)
  `)
  .eq('status', 'pending')
  .order('created_at', { ascending: false });
```

### Get Requests Assigned to Teacher
```javascript
const { data } = await supabase
  .from('guidance_requests')
  .select(`
    id,
    topic,
    notes,
    status,
    created_at,
    student_id,
    student:student_id(full_name)
  `)
  .eq('assigned_to_teacher_id', teacherId)
  .order('created_at', { ascending: false });
```

### Get Sessions for Student (with teacher info)
```javascript
const { data } = await supabase
  .from('guidance_sessions')
  .select(`
    id,
    request_id,
    teacher_id,
    scheduled_for,
    join_link,
    status,
    teacher:teacher_id(full_name)
  `)
  .in('request_id', studentRequestIds)
  .order('scheduled_for', { ascending: false });
```

### Assign Teacher to Request
```javascript
await supabase.from('guidance_requests').update({
  assigned_to_teacher_id: teacherId,
  status: 'assigned',
  assigned_at: new Date().toISOString()
}).eq('id', requestId);
```

### Create Session
```javascript
const joinLink = `https://meet.stepwithnani.com/session/${randomId}`;
await supabase.from('guidance_sessions').insert({
  request_id: requestId,
  teacher_id: teacherId,
  scheduled_for: new Date(userInput).toISOString(),
  join_link: joinLink,
  status: 'scheduled'
});

await supabase.from('guidance_requests').update({
  status: 'scheduled'
}).eq('id', requestId);
```

---

## Status Flow Diagram

```
Student submits request
        ↓
   status: pending
        ↓
Admin assigns teacher
        ↓
   status: assigned
        ↓
Teacher schedules session
        ↓
   status: scheduled
        ↓
Session occurs
        ↓
   status: completed
```

---

## User Permissions

| Action | Student | Teacher | Admin |
|--------|---------|---------|-------|
| Submit Request | ✅ | ❌ | ❌ |
| View Own Requests | ✅ | ❌ | ❌ |
| View All Requests | ❌ | ❌ | ✅ |
| View Assigned Requests | ❌ | ✅ | ✅ |
| Assign Teacher | ❌ | ❌ | ✅ |
| Schedule Session | ❌ | ✅ | ✅ |
| Join Session | ✅ | ✅ | ✅ |
| View Scheduled Sessions | ✅ | ✅ | ✅ |

---

## Email Notifications (Future Enhancement)

- **On Request Submit:** Admin notified of new request
- **On Teacher Assign:** Student notified with teacher name and next steps
- **On Session Schedule:** Student notified with date/time and join link
- **Before Session:** Reminder email 24 hours before
- **After Session:** Thank you email with resources/next steps

---

## Migration Commands

Run in Supabase SQL Editor:

```sql
-- Update guidance_requests table
ALTER TABLE guidance_requests 
DROP COLUMN IF EXISTS user_id;

ALTER TABLE guidance_requests 
ADD COLUMN IF NOT EXISTS student_id uuid references profiles(id) on delete cascade;

ALTER TABLE guidance_requests 
ADD COLUMN IF NOT EXISTS assigned_to_teacher_id uuid references profiles(id);

ALTER TABLE guidance_requests 
ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

-- Update guidance_sessions table
ALTER TABLE guidance_sessions 
RENAME COLUMN scheduled_at TO scheduled_for;

ALTER TABLE guidance_sessions 
ADD COLUMN IF NOT EXISTS created_at timestamptz default now();

-- Create indexes for performance
CREATE INDEX idx_guidance_requests_student_id ON guidance_requests(student_id);
CREATE INDEX idx_guidance_requests_assigned_teacher ON guidance_requests(assigned_to_teacher_id);
CREATE INDEX idx_guidance_requests_status ON guidance_requests(status);
CREATE INDEX idx_guidance_sessions_request_id ON guidance_sessions(request_id);
```

---

## Testing Scenarios

### Scenario 1: Complete Flow (Student → Admin → Teacher)
```
1. Student logs in
2. Goes to Career Guidance > "Request Guidance"
3. Submits request: "Web development career path"
4. Logs out, admin logs in
5. Admin opens Guidance Sessions
6. Sees pending request from student
7. Clicks "Assign Teacher", selects "Teacher Name"
8. Student logs in, sees request now shows "Assigned Teacher: Teacher Name"
9. Teacher logs in, sees the assigned request
10. Clicks "Schedule Session", enters date "2025-01-20 14:00"
11. Student sees session scheduled in "Your Scheduled Sessions"
12. Both can see and click join link
```

### Scenario 2: Status Badge Colors
```
Request submitted: Yellow badge "Pending"
Teacher assigned: Blue badge "Assigned"
Session scheduled: Purple badge "Scheduled"
Session completed: Green badge "Completed"
```

### Scenario 3: Teacher View
```
1. Teacher logs in to Career Guidance
2. Sees section "Requests Assigned to You"
3. Shows all guidance requests assigned to this teacher
4. Can click "Manage Request" to go to GuidanceSessions
5. Sees request in "Assigned Requests" with "Schedule Session" button
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Student can't find request form | Ensure at `/app/guidance-sessions`, not `/app/career-guidance` |
| Admin doesn't see pending requests | Check status filter is for 'pending' only |
| Join link not working | Verify URL format, test in different browser |
| Teacher not in dropdown | Check teacher role in database |
| Date format error | Use "YYYY-MM-DD HH:MM" format |
| Session not appearing for student | Verify request_id in guidance_sessions matches request id |

---

## Configuration

All configurable values:
- **Meet URL Base:** `https://meet.stepwithnani.com/session/`
- **Status Options:** pending, assigned, scheduled, completed
- **Session Status:** scheduled, completed
- **Random ID Length:** 9 characters (in code)

