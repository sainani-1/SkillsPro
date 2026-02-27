# Quick Workflow Guide

## 📋 Attendance Marking Workflow

```
Teacher View:
├─ Select Session
├─ Click Present/Absent buttons
├─ Yellow bar shows "pending changes"
├─ Click "Save Attendance" button
└─ Records lock with 🔒 icon

Admin View (Same as Teacher):
├─ Select Session  
├─ Mark attendance
├─ Click "Save Attendance"
├─ See lock icons on records
└─ Can click pencil icon to UNLOCK
```

---

## 📚 Course Management Workflow

```
Admin Only:
├─ Go to Admin Courses
├─ Click course title to EXPAND
│  ├─ Edit Course Information
│  │  ├─ Title
│  │  ├─ Category
│  │  ├─ Video URL
│  │  └─ Description (notes textarea)
│  ├─ Click "Save Course"
│  ├─ Edit Exam Settings
│  │  ├─ Duration (minutes)
│  │  └─ Pass Percentage (%)
│  └─ Click "Save Exam Settings"
└─ Click course title to COLLAPSE
```

---

## Key Features at a Glance

### Attendance System:
- ✅ Draft mode (mark without saving)
- ✅ Save button (locks records)
- ✅ Lock icons (shows saved status)
- ✅ Disabled buttons (prevents editing)
- ✅ Unlock button (admin only)

### Course Management:
- ✅ Expandable cards (click to expand)
- ✅ Edit title, category, video URL
- ✅ Edit course description/notes
- ✅ Edit exam duration (minutes)
- ✅ Edit exam pass percentage (%)
- ✅ Separate save buttons
- ✅ Edit icons next to sections

### Permissions:
- ✅ Teachers: Mark & Save
- ✅ Admin: Mark, Save, Unlock, Edit Courses
- ✅ Students: View only

---

## Troubleshooting

**Problem:** Lock icon not showing
- Check database - run migrations in Supabase

**Problem:** "Can't unlock" error
- Make sure you're logged in as admin (role='admin')

**Problem:** Course edits don't save
- Click "Save Course" button (not Save Exam Settings)
- Check browser console for errors

**Problem:** Attendance buttons disabled
- This is correct if record is locked
- Admin must unlock first if edit needed

---

## Database Check

To verify database is set up correctly, run in Supabase SQL Editor:

```sql
-- Check if columns exist
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'guidance_attendance';
-- Should include: is_locked, locked_by, updated_at

-- Check exam fields
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'exams';
-- Should include: duration_minutes, pass_percent

-- Check course description
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'courses';
-- Should include: description
```

---

## Files to Know

- **Attendance:** `src/pages/Attendance.jsx` (491 lines)
- **Courses:** `src/pages/AdminCourses.jsx` (266 lines)
- **Database:** Check Supabase → SQL Editor for migrations
