# Session Reassignment System - Visual Flow & Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        STEPWITHNANI PLATFORM                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN LEAVE APPROVAL FLOW                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Admin Panel → Leave Requests Tab                                │
│         ↓                                                         │
│  View Pending Leave Request                                      │
│  - Teacher Name: Rajesh                                          │
│  - Leave Dates: Jan 5-10, 2024                                   │
│  - Reason: Family Event                                          │
│         ↓                                                         │
│  Click "Approve (+ Reassign)" Button                            │
│         ↓                                                         │
│  ┌─────────────────────────────────────────┐                   │
│  │  REASSIGNMENT MODAL POPUP               │                   │
│  ├─────────────────────────────────────────┤                   │
│  │ Reassign sessions during Jan 5-10 to:   │                   │
│  │                                           │                   │
│  │ [Dropdown ▼]                             │                   │
│  │ - Priya Singh                            │                   │
│  │ - Vikram Patel                          │                   │
│  │ - Maya Sharma                           │                   │
│  │                                           │                   │
│  │ [Approve & Reassign] [Cancel]           │                   │
│  └─────────────────────────────────────────┘                   │
│         ↓ (Admin Selects Priya & Confirms)                      │
│  ┌─────────────────────────────────────────┐                   │
│  │  AUTOMATIC BACKEND OPERATIONS           │                   │
│  ├─────────────────────────────────────────┤                   │
│  │ 1. Query: Find sessions where:          │                   │
│  │    - teacher_id = Rajesh                │                   │
│  │    - scheduled_for BETWEEN Jan 5-10     │                   │
│  │    Result: 4 sessions found             │                   │
│  │                                           │                   │
│  │ 2. Create records in:                   │                   │
│  │    session_reassignments table           │                   │
│  │    - 4 reassignment records created     │                   │
│  │                                           │                   │
│  │ 3. Update class_sessions:                │                   │
│  │    - Set teacher_id = Priya             │                   │
│  │    - For all 4 sessions                 │                   │
│  │                                           │                   │
│  │ 4. Update teacher_leaves:                │                   │
│  │    - Set status = 'approved'            │                   │
│  │    - Set admin_comments with details    │                   │
│  └─────────────────────────────────────────┘                   │
│         ↓                                                         │
│  Leave Status: ✅ APPROVED                                       │
│  Admin Comments: "Classes reassigned to Priya Singh"            │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Relationship Diagram

```
                    TEACHER (Rajesh)
                          │
                          ├─────────────────────┐
                          ↓                     ↓
                    TEACHER_LEAVES         CLASS_SESSIONS
                  ┌──────────────────┐    ┌──────────────────┐
                  │ id: 1            │    │ id: 101          │
                  │ teacher_id: R    │    │ teacher_id: R    │
                  │ start_date: 1/5  │    │ title: Class A   │
                  │ end_date: 1/10   │    │ scheduled: 1/5   │
                  │ status: approved │    │ join_link: xxx   │
                  │ admin_comments:  │    └──────────────────┘
                  │ "Reassigned..."  │           │ (UPDATED)
                  └──────────────────┘           │
                          │                      ├─→ teacher_id = Priya
                          │                      └─→ (3 more sessions)
                          │
                          ├─────────────────────────┐
                          ↓                         ↓
                  SESSION_REASSIGNMENTS       TEACHER (Priya)
                  ┌──────────────────────┐
                  │ id: 1                │
                  │ session_id: 101      │
                  │ original_teacher: R  │
                  │ reassigned_to: P     │
                  │ leave_id: 1          │
                  │ reassigned_at: now   │
                  │ reverted_at: null    │
                  └──────────────────────┘
                  (4 records - one per session)
```

---

## User View Flow

### Rajesh's Perspective (Original Teacher):

```
Rajesh's Dashboard
    ↓
Sidebar → "Session Reassignments"
    ↓
┌─────────────────────────────────────────┐
│ SESSION REASSIGNMENTS                    │
│ [Active] [History]                      │
├─────────────────────────────────────────┤
│                                           │
│ ┌─ CARD 1 ─────────────────────────────┐│
│ │ Class A - Jan 5, 9:00 AM             ││
│ │                                        ││
│ │ Original Teacher → Reassigned To      ││
│ │ Rajesh (You) → Priya Singh           ││
│ │                                        ││
│ │ Leave: Jan 5-10 (Family Event)       ││
│ │ [Join Class Link]                    ││
│ └────────────────────────────────────────┘│
│                                           │
│ ┌─ CARD 2 ─────────────────────────────┐│
│ │ Class B - Jan 6, 5:00 PM             ││
│ │ ... (3 more sessions)                 ││
│ └────────────────────────────────────────┘│
│                                           │
└─────────────────────────────────────────┘
```

### Priya's Perspective (Reassigned Teacher):

```
Priya's Dashboard
    ↓
Sidebar → "Session Reassignments"
    ↓
┌─────────────────────────────────────────┐
│ SESSION REASSIGNMENTS                    │
│ [Active] [History]                      │
├─────────────────────────────────────────┤
│                                           │
│ ┌─ CARD 1 ─────────────────────────────┐│
│ │ Class A - Jan 5, 9:00 AM             ││
│ │                                        ││
│ │ Original Teacher → Reassigned To      ││
│ │ Rajesh → Priya Singh (You)           ││
│ │                                        ││
│ │ Covering for: Jan 5-10 (Family Event)││
│ │ [Join Class Link]                    ││
│ └────────────────────────────────────────┘│
│                                           │
│ ┌─ CARD 2 ─────────────────────────────┐│
│ │ Class B - Jan 6, 5:00 PM             ││
│ │ ... (3 more sessions)                 ││
│ └────────────────────────────────────────┘│
│                                           │
└─────────────────────────────────────────┘
```

---

## Complete Leave Management Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                     COMPLETE LEAVE LIFECYCLE                     │
└──────────────────────────────────────────────────────────────────┘

     STEP 1: TEACHER APPLIES FOR LEAVE
     ─────────────────────────────────
     Teacher Panel → Apply Leave
     Fill: Start Date, End Date, Reason
     Status: PENDING
              ↓
     ┌────────────────────────────┐
     │ teacher_leaves table:       │
     │ - status: "pending"        │
     │ - admin_comments: null     │
     └────────────────────────────┘


     STEP 2: ADMIN REVIEWS & APPROVES
     ────────────────────────────────
     Admin Panel → Leave Requests
     See: Rajesh's pending leave (Jan 5-10)
     Click: "Approve (+ Reassign)"
              ↓
     ┌────────────────────────────┐
     │ REASSIGNMENT MODAL SHOWS    │
     │ Select teacher to cover:    │
     │ [Dropdown with teachers]    │
     │ [Approve & Reassign]        │
     └────────────────────────────┘
              ↓
     Backend processes:
     a) Find all sessions for Rajesh from Jan 5-10
     b) Create session_reassignments records
     c) Update class_sessions.teacher_id to Priya
     d) Update leave status to 'approved'
              ↓
     ┌────────────────────────────┐
     │ teacher_leaves table:       │
     │ - status: "approved"       │
     │ - admin_comments:          │
     │   "Classes reassigned..."  │
     │                            │
     │ class_sessions table:       │
     │ - teacher_id: Priya (UPD)  │
     │                            │
     │ session_reassignments:      │
     │ - 4 new records created    │
     └────────────────────────────┘


     STEP 3: BOTH TEACHERS SEE UPDATES
     ─────────────────────────────────
     Rajesh opens "Session Reassignments"
     → Sees 4 classes reassigned to Priya
     
     Priya opens "Session Reassignments"
     → Sees she's covering 4 of Rajesh's classes


     STEP 4A: ADMIN APPROVES AND LEAVE CONTINUES
     ───────────────────────────────────────────
     Priya teaches Rajesh's classes Jan 5-10
     Leave ends on Jan 10
     Status: APPROVED ✅


     STEP 4B: ADMIN REVOKES LEAVE (EARLY)
     ────────────────────────────────────
     Admin clicks "Revoke Leave (Revert Classes)"
              ↓
     Backend processes:
     a) Find all session_reassignments for this leave
     b) Update class_sessions back to Rajesh
     c) Mark reassignments as reverted
     d) Update leave to 'revoked'
              ↓
     ┌────────────────────────────┐
     │ teacher_leaves table:       │
     │ - status: "revoked"        │
     │                            │
     │ class_sessions table:       │
     │ - teacher_id: Rajesh (REV) │
     │                            │
     │ session_reassignments:      │
     │ - reverted_at: timestamp   │
     └────────────────────────────┘
              ↓
     Both teachers see status change
     Reassignments move to "History" tab


     STEP 5: AUDIT TRAIL
     ──────────────────
     All actions tracked:
     ✓ When leave was requested
     ✓ When it was approved
     ✓ Which teacher it was reassigned to
     ✓ When it was revoked/reverted
     ✓ Full timestamps for all changes

```

---

## Data Flow Diagram

```
┌──────────────┐
│   ADMIN UI   │
│  (Approve    │
│   Leave)     │
└────────┬─────┘
         │
         ├→ Selects teacher from dropdown
         │
         └→ Clicks "Approve & Reassign"
                  │
                  ▼
         ┌─────────────────┐
         │  SUPABASE API   │
         │  (Backend)      │
         └────────┬────────┘
                  │
         ┌────────┴────────────────────┐
         │                              │
         ▼                              ▼
    ┌──────────────┐          ┌──────────────────┐
    │ Query DB:    │          │ Create/Update:   │
    │ Find sessions│          │ - teacher_leaves │
    │ during leave │          │ - class_sessions │
    │             │          │ - reassignments  │
    └──────┬───────┘          └────────┬─────────┘
           │                           │
           └─────────────┬─────────────┘
                         │
                         ▼
            ┌────────────────────────┐
            │ SUPABASE DATABASE      │
            ├────────────────────────┤
            │ teacher_leaves         │
            │ class_sessions         │
            │ session_reassignments  │
            │ profiles               │
            └────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                                │
         ▼                                ▼
    ┌──────────────┐            ┌──────────────┐
    │ TEACHER 1 UI │            │ TEACHER 2 UI │
    │  (Rajesh)    │            │  (Priya)     │
    │  Session     │            │  Session     │
    │ Reassignments│            │ Reassignments│
    └──────────────┘            └──────────────┘
         │                           │
         ├→ Sees classes given away  ├→ Sees classes assigned
         │                           │
         └→ Can view & join links    └→ Can teach sessions
```

---

## State Transitions Diagram

```
┌───────────────┐
│    PENDING    │  ← Initial state when teacher applies
└───────┬───────┘
        │
        ├─→ APPROVED ──→ REVOKED
        │     ↑
        │     │ (Teacher can be reassigned
        │     │  at any point)
        │
        └─→ REJECTED


CLASS SESSION STATUS:
─────────────────────

NORMAL:                    DURING LEAVE:
┌────────────────────┐    ┌─────────────────────┐
│ teacher_id: Rajesh │    │ Original: Rajesh    │
│ (Teaches own class)│    │ Reassigned: Priya   │
└────────────────────┘    │ (Priya teaches)     │
                          └─────────────────────┘
                                  │
                                  ├→ When revoked:
                                  │  Back to Rajesh
                                  │
                                  └→ When leave ends:
                                     Stays with Priya


REASSIGNMENT RECORD:
────────────────────
┌──────────────────────────┐
│ reverted_at: null        │  ← ACTIVE
│ (Currently reassigned)   │
└──────────────────────────┘
         │
         └→ ┌──────────────────────────┐
            │ reverted_at: timestamp   │  ← HISTORICAL
            │ (Was reverted)           │
            └──────────────────────────┘
```

---

## UI Component Hierarchy

```
AdminDashboard
├── LeaveRequests (Component)
│   ├── Leave List (Array Map)
│   │   └── Leave Card (Each Leave)
│   │       ├── Leave Info (Date, Teacher, Reason)
│   │       ├── Status Badge
│   │       └── Action Buttons
│   │           ├── [Approve (+ Reassign)]
│   │           ├── [Reject]
│   │           └── [Revoke Leave]
│   │
│   └── ReassignmentModal
│       ├── Modal Header
│       ├── Teacher Dropdown
│       ├── [Approve & Reassign] Button
│       └── [Cancel] Button
│
SessionReassignments (Component)
├── Header
├── Filter Tabs
│   ├── [Active Reassignments]
│   └── [Reverted / History]
├── Reassignments List
│   └── Reassignment Card (Each)
│       ├── Session Info (Title, Date, Time)
│       ├── Teacher Reassignment Info
│       │   └── Original Teacher → Reassigned Teacher
│       ├── Leave Info
│       └── Join Link
└── Empty State (If no reassignments)
```

---

This visual documentation helps understand the complete flow and architecture of the session reassignment system.
