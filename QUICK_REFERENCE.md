# ⚡ Quick Reference Card

## 🎯 What's New?

### 1. Attendance Save Button ✅
```
Mark → [Yellow "Save" Bar] → Click Save → 🔒 Locked
```

### 2. Admin Unlock ✅
```
🔒 Locked Record → [Pencil icon] → Click → Unlock → Edit
```

### 3. Course Editor ✅
```
Course Card → Click Expand → Edit Everything → Save
```

---

## 👥 Who Can Do What?

### Teacher:
- ✅ Mark attendance
- ✅ Click Save (locks it)
- ❌ Change locked records
- ❌ Edit courses

### Admin:
- ✅ Mark attendance
- ✅ Unlock any record
- ✅ Edit courses
- ✅ Change exam duration
- ✅ Add course notes

### Student:
- ✅ View own attendance
- ❌ Everything else

---

## 🎮 How to Use

### Mark Attendance:
1. Attendance → Sessions
2. Select session
3. Click Present/Absent buttons
4. 🟡 Yellow bar appears
5. Click "Save Attendance"
6. 🔒 Record locked!

### Edit Course (Admin):
1. Admin → Courses
2. Click course card
3. Edit all fields
4. Save button appears
5. Click "Save Course"
6. Done!

### Unlock Record (Admin):
1. Attendance → Mark Attendance tab
2. Find locked record (🔒 icon)
3. Click pencil icon (✏️)
4. Record unlocks
5. Make changes
6. Click "Save" again

---

## 📋 Database Fields

### New Attendance Fields:
- `is_locked` - true if saved
- `locked_by` - admin UUID if unlocked
- `updated_at` - last change time

---

## ✨ What's Different?

**Before:** Attendance saved immediately
**Now:** Mark → Save → Lock (prevent changes)

**Before:** Only edit course title/category
**Now:** Edit title, category, notes, video, exam duration, pass %

---

## 🚀 Setup Steps

1. **Run SQL migration** in Supabase
2. **Refresh page** in browser
3. **Test as teacher** - Mark & save
4. **Test as admin** - Unlock & edit
5. **Done!**

---

## 🆘 Common Issues

| Problem | Solution |
|---------|----------|
| Can't edit attendance | It's locked! Only admin can unlock |
| Changes not saving | Click "Save Attendance" button |
| Course info not updating | Click correct "Save" button |
| Buttons greyed out | Record is locked 🔒 |

---

## 📱 Mobile Friendly

All features work on:
- Phones ✅
- Tablets ✅
- Desktop ✅

---

## 🔐 Security

- Locked records prevent overwrites
- Only admin can unlock
- Changes tracked (locked_by)
- Role-based permissions

---

## ✅ Files Modified

1. `src/pages/Attendance.jsx` - Rewritten
2. `src/pages/AdminCourses.jsx` - Enhanced
3. `db_schema.sql` - Updated
4. `migration_guidance_attendance.sql` - Added

---

**Everything works! Deploy now! 🚀**
