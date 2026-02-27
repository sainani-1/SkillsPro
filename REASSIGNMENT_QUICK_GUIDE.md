# Session Reassignment - Quick Reference Guide

## What's New?

When admin **approves a teacher's leave**, all their class sessions during the leave period are **automatically assigned to another teacher**.

Both the **original teacher** and **reassigned teacher** can see these changes in a new "**Session Reassignments**" panel.

---

## For Admins

### Approve Leave with Class Reassignment:

1. Go to **Admin Panel → Leave Requests**
2. Find pending leave request
3. Click **"Approve (+ Reassign)"** button
4. Modal pops up asking which teacher should cover the classes
5. Select teacher from dropdown
6. Click **"Approve & Reassign"**
7. ✅ Done! Classes reassigned automatically

### Revoke Approved Leave:

1. Go to **Admin Panel → Leave Requests**
2. Find approved leave
3. Click **"Revoke Leave (Revert Classes)"**
4. Confirm action
5. ✅ Classes automatically reverted to original teacher

---

## For Teachers

### View Reassigned Classes:

1. Go to **Sidebar → Session Reassignments**
2. See **Active Reassignments** tab (default)
3. View:
   - Classes you had to give to another teacher
   - Classes you're covering for another teacher
4. Click **"Join Class Link"** to teach the session

### Check History:

1. Click **"Reverted / History"** tab
2. See all past reassignments that have been reverted
3. Shows complete audit trail

### Session Details Include:

- ✅ Session title and scheduled date/time
- ✅ Original teacher name
- ✅ Reassigned-to teacher name
- ✅ Leave period (why reassignment happened)
- ✅ Join link for the class
- ✅ Timestamps

---

## Database Changes

**New Table:** `session_reassignments`
- Tracks which sessions were reassigned
- Links to leave request
- Records original and reassigned teachers
- Tracks when reassignment happened and when reverted

**Run this SQL in Supabase:**

```sql
create table if not exists session_reassignments (
  id bigserial primary key,
  session_id bigint references class_sessions(id),
  original_teacher_id uuid references profiles(id),
  reassigned_to_teacher_id uuid references profiles(id),
  leave_id bigint references teacher_leaves(id),
  reason text,
  reassigned_at timestamptz default now(),
  reverted_at timestamptz
);
```

---

## How It Works (Behind the Scenes)

### When Admin Clicks "Approve & Reassign":

1. System finds all class sessions for that teacher during leave dates
2. Creates reassignment records in `session_reassignments` table
3. Updates `class_sessions.teacher_id` to new teacher
4. Marks leave as "approved"
5. Adds comment to leave with reassignment details

### When Admin Revokes:

1. Finds all reassignments for that leave
2. Reverts `class_sessions.teacher_id` to original teacher
3. Marks reassignment as "reverted"
4. Updates leave status to "revoked"

### For Teachers Viewing:

1. SessionReassignments page queries the database
2. Shows reassignments where teacher is original OR reassigned-to
3. Filters by active vs. historical
4. Displays all relevant details

---

## File Changes

### New Files:
- `src/pages/SessionReassignments.jsx` - Teacher reassignments panel

### Modified Files:
- `db_schema.sql` - Added session_reassignments table
- `src/pages/AdminDashboard.jsx` - Enhanced leave approval with reassignment modal
- `src/components/Sidebar.jsx` - Added "Session Reassignments" link
- `src/App.jsx` - Added route for reassignments page

---

## Example Scenario

**Monday, Jan 5:**
- Teacher "Rajesh" applies for leave Jan 5-10
- Rajesh has 4 classes scheduled during this period

**Monday, Jan 5 (afternoon):**
- Admin sees pending leave request
- Clicks "Approve (+ Reassign)"
- Modal asks "Which teacher should cover?"
- Admin selects "Priya" from dropdown
- Clicks "Approve & Reassign"

**Automatic Result:**
- Rajesh's leave status → "Approved"
- 4 classes now assigned to Priya
- Reassignments recorded in database

**Rajesh's View (Jan 5 evening):**
- Goes to "Session Reassignments"
- Sees 4 classes he had reassigned to Priya
- Sees dates, times, and join links
- Knows Priya is covering for him

**Priya's View (Jan 5 evening):**
- Goes to "Session Reassignments"
- Sees 4 classes she's covering for Rajesh
- Can prepare and join each class

**Friday, Jan 10:**
- If admin "Revoke Leave (Revert Classes)"
- All 4 classes automatically revert to Rajesh
- Both see status change in their panels

---

## Key Features

✅ **Automatic** - No manual class updates needed
✅ **Tracked** - Full audit trail of reassignments
✅ **Reversible** - Can revert when revoke leave
✅ **Visible** - Both teachers see the reassignments
✅ **Timestamped** - Know when reassignments happened
✅ **Linked** - Connected to leave request for context

---

## Frequently Asked Questions

**Q: What if teacher has no sessions during leave period?**
A: Reassignment completes successfully, but no sessions to reassign.

**Q: Can teacher see who approved the leave?**
A: Yes, admin comments show the reassignment details.

**Q: What if reassigned teacher declines?**
A: Currently system doesn't have decline flow. Admin must revoke and reassign to different teacher.

**Q: Are students notified of teacher change?**
A: No, currently not implemented. Consider adding email notifications.

**Q: Can multiple teachers cover for one teacher?**
A: Currently one teacher per leave. Can add feature to distribute across multiple teachers.

---

## Next Enhancements (Optional)

- 📧 Email notifications to reassigned teacher
- 📱 SMS reminder before reassigned session
- 📊 Admin stats on leave impact and workload
- 🔄 Allow multiple teachers to share the load
- ⏰ Automatic notification to students about teacher change
- 📋 Attendance tracking showing which teacher took it
- ⭐ Teacher ratings/feedback on coverage quality

---

## Support & Troubleshooting

If reassignments aren't appearing:
1. Check database migration ran successfully
2. Verify RLS policies are in place
3. Clear browser cache and refresh
4. Check console for any errors
5. Verify dates/times are in correct timezone

Contact admin for any reassignment-related issues.
