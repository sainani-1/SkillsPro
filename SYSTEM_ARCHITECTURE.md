# System Architecture - Guidance & Mentor Features

## User Roles & Capabilities

```
┌─────────────────────────────────────────────────────────────────┐
│                           SYSTEM USERS                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  STUDENT                  TEACHER                    ADMIN        │
│  ├─ Submit Requests        ├─ View Assigned        ├─ See All    │
│  ├─ View Status            │   Requests             │   Requests  │
│  ├─ Join Sessions          ├─ Schedule Sessions    ├─ Assign     │
│  └─ See Mentors            └─ Provide Sessions     │   Teachers  │
│                                                     ├─ Assign     │
│                                                     │   Mentors   │
│                                                     └─ Manage     │
│                                                         All       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

```
┌──────────────────────────┐
│       PROFILES           │
├──────────────────────────┤
│ id (UUID)                │
│ full_name                │
│ email                    │
│ role (student|teacher|   │
│   admin)                 │
│ created_at               │
└────┬─────────────────────┘
     │
     ├────────────────────┬──────────────────┬─────────────────────┐
     │                    │                  │                     │
     │                    │                  │                     │
┌────▼─────────────────┐ ┌─▼──────────────────┐ ┌─▼─────────────────┐
│ guidance_requests    │ │ teacher_assignments│ │guidance_sessions   │
├──────────────────────┤ ├────────────────────┤ ├────────────────────┤
│ id                   │ │ id                 │ │ id                 │
│ student_id (FK) ────┼─┼──> profile.id      │ │ request_id (FK) ───┼──┐
│ topic                │ │ student_id (FK) ──┼─┼──> profile.id      │  │
│ notes                │ │ teacher_id (FK) ──┼─┼──> profile.id      │  │
│ status               │ │ assigned_by (FK) ──┼─┼──> profile.id      │  │
│ assigned_to_teacher_ │ │ assigned_at        │ │ teacher_id (FK) ───┼──┤
│ id (FK) ────┐        │ │ active = true      │ │ scheduled_for      │  │
│ created_at  │        │ │ UNIQUE constraint  │ │ join_link          │  │
│ assigned_at │        │ │ prevents duplicate │ │ status             │  │
└─────────────┼────────┘ │ assignments        │ │ created_at         │  │
              │          └────────────────────┘ └────────────────────┘  │
              │                                                         │
              │         KEY RELATIONSHIPS:                              │
              │                                                         │
              └─────────────────────────────────────────────────────────┘
                  Teacher assigned to specific request
```

---

## Component Flow Diagram

```
GuidanceSessions.jsx
│
├─ useAuth() → Get profile (student/teacher/admin)
│
├─ useState() → State management:
│   ├─ requests: [] → Guidance requests
│   ├─ sessions: [] → Scheduled sessions
│   ├─ students: [] → All students (admin only)
│   ├─ teachers: [] → All teachers
│   ├─ mentors: [] → Active mentor assignments
│   └─ Modal states → For assignment forms
│
├─ useEffect() → Load data on mount
│   └─ loadData() →
│       ├─ If STUDENT:
│       │   ├─ Fetch guidance_requests WHERE student_id = me
│       │   └─ Fetch guidance_sessions for my requests
│       │
│       ├─ If TEACHER:
│       │   ├─ Fetch guidance_requests WHERE assigned_to_teacher_id = me
│       │   └─ Fetch guidance_sessions for my requests
│       │
│       └─ If ADMIN:
│           ├─ Fetch all guidance_requests
│           ├─ Fetch all guidance_sessions
│           ├─ Fetch all teacher_assignments WHERE active = true
│           ├─ Fetch all profiles WHERE role = 'student'
│           └─ Fetch all profiles WHERE role = 'teacher'
│
├─ Render Components:
│   ├─ Student Section:
│   │   ├─ Request Form (Submit guidance request)
│   │   ├─ Request History (View own requests)
│   │   └─ Scheduled Sessions (View & join meetings)
│   │
│   ├─ Teacher Section:
│   │   ├─ "Your Assigned Guidance Requests"
│   │   │   ├─ Shows only requests assigned to THIS teacher
│   │   │   └─ Action: "Schedule Session"
│   │   │
│   │   └─ Scheduled Sessions
│   │       └─ Shows sessions + join links
│   │
│   └─ Admin Section:
│       ├─ "Pending Requests"
│       │   └─ Action: "Assign Teacher"
│       │
│       ├─ "Assigned Requests"
│       │   └─ Shows which teacher + date
│       │
│       ├─ "Scheduled Sessions"
│       │   └─ Shows all sessions + links
│       │
│       └─ "Student Mentors" (NEW)
│           ├─ Table of mentor assignments
│           └─ Actions: "Assign Mentor", "Remove"
│
└─ Modals:
    ├─ Assign Teacher Modal
    │   ├─ Shows request topic + student ID
    │   ├─ Select teacher dropdown
    │   └─ Action: assignTeacher()
    │
    └─ Assign Mentor Modal (NEW)
        ├─ Select student dropdown
        ├─ Select mentor dropdown
        └─ Action: assignMentor()
```

---

## Data Flow Diagrams

### Guidance Request Flow

```
STEP 1: STUDENT SUBMITS REQUEST
┌─────────────┐
│   STUDENT   │
│  Component  │
└──────┬──────┘
       │ Form Input:
       │   • Topic
       │   • Notes (optional)
       │
       ▼
┌──────────────────────────────┐
│   submitRequest() Function   │
│  • Validate input            │
│  • Call supabase.insert()    │
└──────────────┬───────────────┘
               │
               ▼
        ┌─────────────┐
        │  SUPABASE   │
        │ guidance_   │
        │ requests    │
        │   TABLE     │
        │   [NEW]     │
        │  student_   │
        │    id: ME   │
        │  status:    │
        │  'pending'  │
        └──────┬──────┘
               │
               ▼
        [ STORED IN DB ]

STEP 2: ADMIN SEES & ASSIGNS TEACHER
┌─────────────┐
│   ADMIN     │
│ Component   │
└──────┬──────┘
       │ loadData()
       │ fetches all pending
       │ requests
       │
       ▼
┌───────────────────────────────┐
│ See "Pending Requests (X)"    │
│ Click "Assign Teacher"        │
│ Select teacher from dropdown  │
│ Click "Assign"                │
└──────────────┬────────────────┘
               │
               ▼
     ┌──────────────────────┐
     │ assignTeacher()      │
     │ Updates supabase:    │
     │  • assigned_to_      │
     │    teacher_id = X    │
     │  • status =          │
     │    'assigned'        │
     │  • assigned_at =     │
     │    NOW               │
     └──────────┬───────────┘
                │
                ▼
        [ UPDATED IN DB ]

STEP 3: TEACHER SEES REQUEST
┌─────────────┐
│  TEACHER    │
│ Component   │
└──────┬──────┘
       │ loadData()
       │ fetches WHERE
       │ assigned_to_
       │ teacher_id = ME
       │
       ▼
┌──────────────────────────┐
│ See "Your Assigned       │
│ Guidance Requests"       │
│ Click "Schedule Session" │
│ Enter date/time          │
│ Click "Schedule"         │
└──────────┬───────────────┘
           │
           ▼
    ┌─────────────────────────┐
    │ scheduleSession()       │
    │ • Generate join_link    │
    │ • Insert guidance_      │
    │   sessions row          │
    │ • Update status to      │
    │   'scheduled'           │
    └──────────┬──────────────┘
               │
               ▼
        [ SCHEDULED ]

STEP 4: STUDENT SEES SCHEDULED SESSION
┌─────────────┐
│   STUDENT   │
│ Component   │
└──────┬──────┘
       │ loadData()
       │ fetches my
       │ guidance_requests
       │ & sessions
       │
       ▼
┌────────────────────────┐
│ See request now shows: │
│ • status: 'scheduled'  │
│ • Meeting date/time    │
│ • "Join" link button   │
└────────────┬───────────┘
             │
             ▼
    [ CAN ATTEND SESSION ]
```

---

### Mentor Assignment Flow

```
┌─────────────┐
│   ADMIN     │
│ Component   │
└──────┬──────┘
       │
       │ Click "Assign Mentor"
       │
       ▼
┌───────────────────────────────┐
│  Mentor Assignment Modal      │
│  ┌─────────────────────────┐  │
│  │ Select Student:         │  │
│  │ [Dropdown ▼]            │  │
│  ├─────────────────────────┤  │
│  │ Select Mentor:          │  │
│  │ [Dropdown ▼]            │  │
│  ├─────────────────────────┤  │
│  │ [Assign] [Cancel]       │  │
│  └────────┬────────────────┘  │
└───────────┼────────────────────┘
            │
            │ Validate + Click "Assign"
            │
            ▼
  ┌───────────────────────────┐
  │   assignMentor()          │
  │ Function                  │
  │                           │
  │ Insert into               │
  │ teacher_assignments:      │
  │  • teacher_id: selected   │
  │  • student_id: selected   │
  │  • assigned_by: me        │
  │  • assigned_at: NOW       │
  │  • active: true           │
  └────────────┬──────────────┘
               │
               ▼
   ┌─────────────────────────┐
   │ supabase.from(          │
   │  'teacher_assignments'  │
   │ ).insert(data)          │
   └────────────┬────────────┘
                │
                ▼
        ┌───────────────┐
        │   SUPABASE    │
        │               │
        │ teacher_      │
        │ assignments   │
        │   TABLE       │
        │   [INSERTED]  │
        └────────┬──────┘
                 │
                 ▼
    ┌────────────────────────┐
    │ Reload data via        │
    │ loadData()             │
    │                        │
    │ Fetch mentors with:    │
    │ .eq('active', true)    │
    └────────────┬───────────┘
                 │
                 ▼
    ┌────────────────────────┐
    │ Display in "Student    │
    │ Mentors" table         │
    │                        │
    │ Columns:               │
    │  • Student Name        │
    │  • Mentor Name         │
    │  • Assigned By         │
    │  • Assigned Date       │
    │  • Status (Active)     │
    │  • [Remove] button     │
    └────────────────────────┘
```

---

## Request Status Lifecycle

```
┌──────────────┐
│   PENDING    │  ← Student submitted request
│              │    Admin hasn't assigned teacher yet
│   Color: 🟡  │
└──────┬───────┘
       │ Admin clicks "Assign Teacher"
       │ Selects teacher from dropdown
       │ Clicks "Assign"
       │
       ▼
┌──────────────┐
│   ASSIGNED   │  ← Teacher is assigned
│              │    Now visible in teacher's panel
│   Color: 🔵  │
└──────┬───────┘
       │ Teacher schedules session
       │ Enters date/time for meeting
       │ System generates join link
       │
       ▼
┌──────────────┐
│  SCHEDULED   │  ← Session scheduled with date/time
│              │    Student can see & join at time
│   Color: 🟣  │
└──────┬───────┘
       │ At scheduled time:
       │ Teacher & student join session
       │
       ▼
┌──────────────┐
│ COMPLETED    │  ← Session happened
│              │    Guidance provided
│   Color: 🟢  │
└──────────────┘
```

---

## File Organization

```
src/
├─ pages/
│  └─ GuidanceSessions.jsx (MODIFIED)
│     ├─ Student Form & History
│     ├─ Teacher Assigned Requests View
│     ├─ Admin Management Panel
│     │  ├─ Pending Requests
│     │  ├─ Assigned Requests
│     │  ├─ Scheduled Sessions
│     │  └─ Student Mentors (NEW)
│     ├─ Modals:
│     │  ├─ Assign Teacher Modal
│     │  └─ Assign Mentor Modal (NEW)
│     └─ Modals functions:
│        ├─ assignTeacher()
│        ├─ scheduleSession()
│        └─ assignMentor() (NEW)
│
├─ supabaseClient.js (No changes)
│
└─ context/
   └─ AuthContext.jsx (No changes)

Database (Supabase):
├─ profiles (Existing)
├─ guidance_requests (Updated)
├─ guidance_sessions (Updated)
└─ teacher_assignments (Existing - used for mentors)
```

---

## Query Patterns Used

```javascript
// TEACHER: See only their assigned requests
supabase.from('guidance_requests')
  .select('*')
  .eq('assigned_to_teacher_id', profile.id)  // KEY: Filter by teacher ID
  .order('created_at', { ascending: false })

// ADMIN: See all pending requests
supabase.from('guidance_requests')
  .select('*')
  .eq('status', 'pending')  // All pending, not assigned to anyone

// ADMIN: Fetch mentor assignments
supabase.from('teacher_assignments')
  .select('*')
  .eq('active', true)  // Only active assignments

// ADMIN: Create mentor assignment
supabase.from('teacher_assignments').insert({
  teacher_id: selectedMentor,
  student_id: selectedStudent,
  assigned_by: profile.id,
  assigned_at: new Date().toISOString(),
  active: true
})

// STUDENT: See sessions for their requests
supabase.from('guidance_sessions')
  .select('*')
  .in('request_id', myRequestIds)
```

---

## Summary

```
┌─────────────────────────────────────────┐
│   GUIDANCE & MENTOR SYSTEM COMPLETE    │
├─────────────────────────────────────────┤
│                                         │
│ ✅ Teacher Panel - Fixed               │
│    Teachers only see their assigned     │
│    requests (not all)                   │
│                                         │
│ ✅ Mentor Feature - New                │
│    Admins can assign mentors to        │
│    students for ongoing mentorship     │
│                                         │
│ ✅ Request Status Flow                 │
│    Pending → Assigned → Scheduled      │
│                                         │
│ ✅ Error Handling                      │
│    Clear messages instead of silence   │
│                                         │
│ ✅ UI/UX Improvements                  │
│    Organized by role & status          │
│                                         │
└─────────────────────────────────────────┘
```
