# Course Management System - Complete Guide

## Overview
The CourseList page has been completely redesigned with the following features:

1. **Search Functionality** - Search courses by title or category
2. **Category Filter** - Filter courses by category
3. **Add New Courses** - Admins can add courses directly from the website
4. **Edit Courses** - Admins can edit course details including video links
5. **Delete Courses** - Admins can delete courses with confirmation
6. **Google Drive Video Integration** - Support for iframe embeds
7. **Database Integration** - Pulls real courses from database instead of mock data

---

## Features Explained

### 1. Search Bar
- **Location**: Top of the All Courses page
- **Function**: Search courses by title or category in real-time
- **How to Use**: 
  - Type course name (e.g., "Python")
  - Type category (e.g., "Programming")
  - Results update instantly as you type

### 2. Category Filter
- **Location**: Below search bar
- **Categories**: All, Programming, CS Core, Web, DevOps, Data, Data Science, Design, Mobile, Security, Cloud, Productivity, Emerging Tech
- **How to Use**: Click on any category to filter courses

### 3. Add New Course (Admin Only)
- **How to Access**: Click "Add Course" button in header (only visible if logged in as admin)
- **Modal Form Fields**:
  - **Course Title** * (required) - Name of the course
  - **Category** * (required) - Select from predefined categories
  - **Description** - Course overview and learning outcomes
  - **Thumbnail/Image URL** - Course card image URL
  - **Video URL or Embed Code** - YouTube URL or Drive iframe
  - **Notes/PDF URL** - Link to course materials

**Example Values:**
```
Title: Complete Python Mastery
Category: Programming
Description: Learn Python from basics to advanced level with 45 lessons
Thumbnail: https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=800&q=80
Video: <iframe src="https://drive.google.com/file/d/FILE_ID/preview" width="640" height="480" allow="autoplay"></iframe>
Notes: https://drive.google.com/file/d/PDF_FILE_ID/view
```

### 4. Edit Course (Admin Only)
- **How to Access**: Hover over course card, click blue "Edit" icon
- **What You Can Edit**:
  - Course title
  - Category
  - Description
  - Thumbnail image URL
  - Video URL or embed code
  - Notes/PDF URL
- **Save Changes**: Click "Update Course" button

### 5. Delete Course (Admin Only)
- **How to Access**: Hover over course card, click red "Trash" icon
- **Confirmation Modal**: Shows warning about permanent deletion
- **What Gets Deleted**:
  - Course record
  - All exams for this course
  - All exam questions
  - All student submissions and attempts
- **Warning**: This action cannot be undone!

### 6. Google Drive Video Integration

#### How to Embed Drive Video in Course:

**Step 1**: Upload video to Google Drive
**Step 2**: Right-click video → Open Menu
**Step 3**: Click "Share" and set to "Anyone with the link"
**Step 4**: Click the 3-dot menu (⋯) → "Embed item"
**Step 5**: Copy the entire iframe code

**Example iframe code:**
```html
<iframe src="https://drive.google.com/file/d/1A2B3C4D5E6F/preview" width="640" height="480" allow="autoplay"></iframe>
```

**Step 6**: Paste into "Video URL or Embed Code" field when adding/editing course

#### How to Get Drive Image URL:

**Step 1**: Upload image to Google Drive
**Step 2**: Right-click → "Get link"
**Step 3**: Change to "Anyone with the link"
**Step 4**: Copy the link
**Step 5**: Extract the File ID from the URL

**Convert to direct image URL:**
```
Original: https://drive.google.com/file/d/FILE_ID/view
Direct: https://drive.google.com/thumbnail?id=FILE_ID
Or:     https://lh3.googleusercontent.com/d/FILE_ID
```

### 7. Database Integration

**Data Source**: Courses table in Supabase
**Fallback**: If no courses exist in database, falls back to mock courses

**Database Schema:**
```sql
courses (
  id: bigint (auto),
  title: text (required),
  category: text (required),
  description: text,
  thumbnail_url: text,
  video_url: text,
  notes_url: text,
  is_active: boolean (default: true),
  created_at: timestamp
)
```

---

## Complete Workflow Example

### Adding a Programming Course:

1. **Go to**: CourseList page (All Courses)
2. **Click**: "Add Course" button (top right)
3. **Fill Form**:
   - Title: "Web Dev with React Advanced"
   - Category: Web
   - Description: "Advanced React patterns, hooks, context API, and state management"
   - Thumbnail: Copy a web development image URL
   - Video: Paste iframe from Google Drive
   - Notes: Paste PDF link

4. **Submit**: Click "Add Course"
5. **Confirm**: Check if course appears at top of grid
6. **Result**: Course is now in database and visible to all users

### Editing a Course:

1. **Hover** over course card
2. **Click** blue pencil icon
3. **Modify** any field
4. **Click** "Update Course"
5. **Verify** changes are saved

### Deleting a Course:

1. **Hover** over course card
2. **Click** red trash icon
3. **Review** warning modal
4. **Click** "Delete" to confirm
5. **Verify** course is removed from database

---

## FAQ

### Q: Can I add courses without using the admin panel?
**A**: Yes! Any admin can now add courses directly from the website using the "Add Course" button. You don't need to access the admin panel.

### Q: Can I add questions and answers to courses?
**A**: Questions are added through the Exam system. When you create a course, a default exam is automatically created. You can then:
1. Go to Admin Courses page
2. Open the course details
3. Add exam questions in the exam section

### Q: Why is my video not displaying?
**A**: 
- Make sure to use the full `<iframe>` embed code, not just the URL
- Verify the Drive file is shared as "Anyone with the link"
- Check browser console for errors

### Q: Can regular users add courses?
**A**: No, only admins can add/edit/delete courses. Regular students can view and access courses (if premium).

### Q: What happens when I delete a course?
**A**: Permanent deletion of:
- The course itself
- All associated exams
- All exam questions for those exams
- All student submissions and attempts

### Q: Can I search courses?
**A**: Yes! Use the search bar to search by:
- Course title (partial matches work)
- Category name

### Q: Does pagination exist?
**A**: No, all courses are displayed in one page with infinite scroll capability via grid layout.

---

## Technical Details

### Search Implementation
```javascript
const filteredCourses = courses.filter(course => {
  const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         course.category.toLowerCase().includes(searchQuery.toLowerCase());
  const matchesCategory = selectedCategory === 'All' || course.category === selectedCategory;
  return matchesSearch && matchesCategory;
});
```

### Database Queries
```javascript
// Fetch courses
const { data } = await supabase
  .from('courses')
  .select('*')
  .order('created_at', { ascending: false });

// Add course
await supabase.from('courses').insert([newCourse]).select().single();

// Update course
await supabase.from('courses').update({...}).eq('id', course.id);

// Delete course (with cascade)
await supabase.from('exams').delete().eq('course_id', courseId);
await supabase.from('courses').delete().eq('id', courseId);
```

### State Management
```javascript
const [courses, setCourses] = useState([]);
const [searchQuery, setSearchQuery] = useState('');
const [selectedCategory, setSelectedCategory] = useState('All');
const [showAddCourseModal, setShowAddCourseModal] = useState(false);
const [editingCourse, setEditingCourse] = useState(null);
const [showEditModal, setShowEditModal] = useState(false);
const [deleteConfirm, setDeleteConfirm] = useState(null);
```

---

## Accessibility Features

- ✅ Search with keyboard support
- ✅ Filter buttons are clickable and styled
- ✅ Modal forms have proper labels
- ✅ Confirmation dialogs prevent accidental deletion
- ✅ Loading states for async operations
- ✅ Error alerts for failed operations
- ✅ Responsive design for all screen sizes

---

## Future Enhancements

Possible additions:
- [ ] Bulk course import/export (CSV)
- [ ] Course duplication feature
- [ ] Course rating system
- [ ] Student reviews and feedback
- [ ] Course completion statistics
- [ ] Advanced search filters
- [ ] Course preview before adding
- [ ] Image upload to cloud storage (instead of URL)
- [ ] Video upload to cloud storage (instead of iframe)
- [ ] Course dependencies (prerequisite courses)
- [ ] Course scheduling and availability
- [ ] Bulk edit functionality

---

## Troubleshooting

### Issue: Courses not loading
**Solution**: 
- Check Supabase connection
- Verify database has courses table
- Check browser console for errors

### Issue: Search not working
**Solution**:
- Clear search box and try again
- Check spelling of course title
- Try searching by category instead

### Issue: Add course button not showing
**Solution**:
- Make sure you're logged in as admin
- Check user role in database (should be 'admin')
- Refresh page

### Issue: Video not displaying in course card
**Solution**:
- Video is added but only displays when course is opened
- Check that video_url is valid
- Verify iframe syntax is correct

### Issue: Delete not working
**Solution**:
- Check browser console for errors
- Verify you have admin permissions
- Ensure course exists in database

---

## User Roles

### Admin Users
- ✅ Add courses
- ✅ Edit course details
- ✅ Delete courses
- ✅ View all courses
- ✅ Access exam questions

### Premium Students
- ✅ View all courses
- ✅ Watch videos
- ✅ Access notes
- ✅ Take exams
- ❌ Cannot modify courses

### Free Students
- ❌ Cannot access courses (see premium lock)
- ❌ Cannot modify courses

---

## Database Relationships

```
courses (1) → (Many) exams
courses (1) → (Many) enrollments
exams (1) → (Many) exam_questions
exams (1) → (Many) exam_submissions
exam_submissions (1) → (Many) exam_answers
```

---

## Version History

**v2.0** - Current
- Search functionality
- Category filtering
- Add/Edit/Delete courses
- Google Drive integration
- Database integration
- Real-time filtering

**v1.0** - Previous
- Static mock courses only
- No search
- No editing
- Manual category buttons
