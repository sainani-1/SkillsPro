# Session Reassignment System - Complete Implementation

## Overview
When an admin approves a teacher's leave request, all of that teacher's scheduled class sessions during the leave period are automatically reassigned to another teacher. Teachers can view all their session reassignments in the "Session Reassignments" tab.

## What Was Implemented

### 1. Database Schema
**New Table: `session_reassignments`**
```sql
create table if not exists session_reassignments (
  id bigserial primary key,
  session_id bigint references class_sessions(id) on delete cascade,
  original_teacher_id uuid references profiles(id),
  reassigned_to_teacher_id uuid references profiles(id),
  leave_id bigint references teacher_leaves(id),
  reason text,
  reassigned_at timestamptz default now(),
  reverted_at timestamptz
);
```

**Purpose:**
- Tracks which sessions were reassigned
- Stores original teacher and reassigned-to teacher
- Links to the leave request
- Records when reassignment happened and when it was reverted

---

## 2. Admin Approval Panel Enhancement

**File:** `src/pages/AdminDashboard.jsx` (LeaveRequests component)

### New Features:
- ✅ **Modal Popup** when clicking "Approve (+ Reassign)" button
- ✅ **Select teacher** dropdown to reassign classes to
- ✅ **Auto-find** all sessions during the leave period
- ✅ **Automatic reassignment** of all matching sessions
- ✅ **Revert functionality** when revoking approved leave

### Admin Workflow:

1. **View Pending Leave Request**
   - Go to Admin Panel → "Leave Requests" tab
   - See all pending leave applications

2. **Click "Approve (+ Reassign)"**
   - Modal pops up showing:
     - Teacher name
     - Leave dates
     - Dropdown to select reassignment teacher

3. **Select Reassignment Teacher**
   - Choose which teacher will handle the classes
   - Click "Approve & Reassign"

4. **Automatic Actions:**
   - Leave status → "Approved"
   - All sessions during leave period → reassigned to selected teacher
   - Reassignment record created in database
   - Teacher notes added to leave showing who took the classes

5. **Revoke Option**
   - For approved leaves, can click "Revoke Leave (Revert Classes)"
   - All classes automatically revert to original teacher
   - Reassignment marked as "reverted_at"

---

## 3. Teacher Session Reassignments Panel

**File:** `src/pages/SessionReassignments.jsx`

### Features:
- ✅ View all active reassignments
- ✅ See both directions:
  - Classes you had reassigned to others
  - Classes reassigned TO you
- ✅ Filter between "Active Reassignments" and "Historical"
- ✅ See detailed info:
  - Session title and date/time
  - Original teacher name
  - Reassigned-to teacher name
  - Leave period dates
  - Reason for reassignment
  - Join link to the class
- ✅ Color indicators showing status
- ✅ Badges for "You" in teacher names

### Teacher Workflow:

1. **Go to Sidebar → "Session Reassignments"**
   - Teachers see their own reassignments

2. **Active Reassignments Tab (Default)**
   - Shows classes currently reassigned
   - Shows classes you're teaching for another teacher

3. **See Detailed Info:**
   - Which class and when
   - Who the original teacher was
   - Who's teaching now
   - Leave period for context
   - Join link to conduct the class

4. **Historical Tab**
   - See past reassignments that have been reverted
   - Complete audit trail

---

## Database Migration

Run this SQL in Supabase SQL Editor:

```sql
-- Create session reassignments table
create table if not exists session_reassignments (
  id bigserial primary key,
  session_id bigint references class_sessions(id) on delete cascade,
  original_teacher_id uuid references profiles(id),
  reassigned_to_teacher_id uuid references profiles(id),
  leave_id bigint references teacher_leaves(id),
  reason text,
  reassigned_at timestamptz default now(),
  reverted_at timestamptz
);

-- Enable RLS
alter table session_reassignments enable row level security;

-- Teachers can view reassignments related to them
create policy "teachers_view_reassignments" on session_reassignments
  for select using (
    original_teacher_id = auth.uid() or 
    reassigned_to_teacher_id = auth.uid()
  );

-- Admins can view all reassignments
create policy "admins_view_reassignments" on session_reassignments
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Admins can insert reassignments
create policy "admins_insert_reassignments" on session_reassignments
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Admins can update reassignments
create policy "admins_update_reassignments" on session_reassignments
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
```

---

## File Changes Summary

### Modified Files:
1. **db_schema.sql**
   - Added `session_reassignments` table

2. **src/pages/AdminDashboard.jsx**
   - Enhanced LeaveRequests component with:
     - Modal for teacher selection
     - Logic to find sessions during leave period
     - Auto-reassignment of sessions
     - Revert functionality
     - Better button labels

3. **src/components/Sidebar.jsx**
   - Added "Session Reassignments" link for teachers

4. **src/App.jsx**
   - Added import for SessionReassignments component
   - Added route: `/app/session-reassignments`

### New Files:
- **src/pages/SessionReassignments.jsx**
  - Complete page for viewing reassignments
  - Filter tabs (Active/Historical)
  - Detailed reassignment info cards

---

## Feature Flow Diagram

```
Admin Approves Leave
    ↓
Modal: "Select Reassignment Teacher"
    ↓
Query: Find all sessions for teacher during leave dates
    ↓
Actions:
  1. Update leave status → "approved"
  2. Create session_reassignments records
  3. Update class_sessions.teacher_id
    ↓
Teacher Sees in "Session Reassignments" Tab
    ↓
Classes shown with original teacher and reassigned teacher
    ↓
Can join sessions with provided join link
    ↓
When Leave Reverted:
  1. Find all session_reassignments for this leave
  2. Revert class_sessions.teacher_id back to original
  3. Mark session_reassignments.reverted_at
```

---

## UI/UX Details

### Admin Approval Modal:
- Clean modal with teacher dropdown
- Shows leave dates and teacher name
- Disable button if no teacher selected
- Loading state during processing

### Teacher Reassignments Page:
- Header with clear title and description
- Two filter buttons: Active / Historical
- Cards showing:
  - Session title, date, time
  - Original teacher (with "You" badge if applicable)
  - Reassigned-to teacher (with "You" badge if applicable)
  - Leave period info
  - Join link
  - Timestamp info
- Empty state when no reassignments
- Color-coded status (blue for active, gray for reverted)

---

## Usage Examples

### Example 1: Approve Leave with Reassignment

**Admin Action:**
1. Admin sees leave request from "Raj Kumar" for Jan 5-10
2. Clicks "Approve (+ Reassign)"
3. Modal appears, selects "Priya Singh" to cover classes
4. Clicks "Approve & Reassign"
5. Leave approved, 3 sessions reassigned to Priya

**Raj's View:**
- In "Session Reassignments" page
- Sees 3 sessions marked as "reassigned to Priya Singh"
- Can view all details

**Priya's View:**
- In "Session Reassignments" page
- Sees 3 sessions she's covering for Raj
- Can join and teach these sessions

### Example 2: Revoke Approved Leave

**Admin Action:**
1. Admin finds approved leave for Raj
2. Clicks "Revoke Leave (Revert Classes)"
3. Confirms action

**Result:**
- All 3 sessions automatically revert to Raj
- Reassignments marked as "reverted"
- Teachers can see in "Historical" tab

---

## Integration Points

### Required:
- ✅ Database migration (SQL provided)
- ✅ RLS policies (SQL provided)

### Optional Enhancements:
- Email notifications to reassigned teacher
- SMS reminder before reassigned session
- Performance metrics on reassignment workload
- Admin dashboard stats on leave impact

---

## Troubleshooting

**Q: Sessions not appearing in reassignments?**
- Check if sessions have proper `scheduled_for` dates
- Verify session dates fall within leave period
- Check RLS policies allow access

**Q: Reassignments not reverting?**
- Verify revocation process completed
- Check `reverted_at` timestamp updated
- Check class_sessions.teacher_id reverted

**Q: Teacher can't see reassignments?**
- Verify RLS policies for teacher read access
- Check teacher is either original or reassigned-to
- Refresh page after reassignment

---

## Testing Checklist
- [ ] Admin can view all pending leaves
- [ ] Modal appears on "Approve (+ Reassign)" click
- [ ] Teacher dropdown populated with all teachers
- [ ] Clicking "Approve & Reassign" creates reassignment
- [ ] Sessions automatically reassigned in database
- [ ] Teacher sees sessions in reassignments page
- [ ] Reassigned-to teacher sees sessions they're covering
- [ ] Filter buttons work (Active/Historical)
- [ ] Revoke button works, sessions revert
- [ ] Historical tab shows reverted reassignments
- [ ] Join links are clickable and valid
- [ ] Error handling for failed reassignments
- [ ] Timestamps display correctly

---

## Next Steps
1. Apply SQL migration in Supabase
2. Set up RLS policies
3. Test full workflow: Apply Leave → Approve → Reassign → View → Revoke
4. Verify sessions update in class schedule views
5. Test with multiple sessions and different teachers
