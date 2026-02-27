# Course System - Enrollment & Video Guide

## Overview

The course system now has:
1. **Enrollment requirement** - Users must enroll before accessing course content
2. **Iframe video player** - Displays Google Drive and YouTube videos properly
3. **Notes system** - Opens notes in new tab (PDFs, Google Docs, Drive files)
4. **Better course detail page** - Shows all course information

---

## How It Works Now

### Step 1: User Visits Course (Premium Only)
- User goes to course from "All Courses" page
- If not premium → sees "Premium Required" message

### Step 2: Enrollment Screen
- If not enrolled → sees enrollment message
- Shows benefits of enrolling:
  - Full course videos and materials
  - Course notes and downloads
  - Final exam to earn certificate
  - Progress tracking
- User clicks "Enroll Now"

### Step 3: After Enrollment
- Full course content unlocked
- Can view:
  - **Video player** with iframe
  - **Notes tab** with download link
  - **Exam tab** with exam info
- Can access at any time

---

## For Admins: How to Set Up Courses Properly

### Adding Video (Google Drive)

**Step 1**: Get Google Drive Video
1. Upload video to Google Drive
2. Right-click → Share → "Anyone with the link"
3. Click 3-dot menu → "Embed item"
4. Copy the entire `<iframe>` code

**Example:**
```html
<iframe src="https://drive.google.com/file/d/FILE_ID/preview" width="640" height="480" allow="autoplay"></iframe>
```

**Step 2**: Add to Course in Admin Panel
1. Go to Admin Courses
2. Click "Add Course" or "Edit Course"
3. Paste iframe code in "Video URL or Embed Code" field
4. Click Save/Create

**Result**: When user enrolls and opens course, iframe video displays in player

---

### Adding YouTube Video

**Option 1**: YouTube Share URL
1. Get YouTube video link: `https://www.youtube.com/watch?v=VIDEO_ID`
2. Paste in "Video URL or Embed Code" field

**Option 2**: YouTube Embed Code
1. Click Share → Embed
2. Copy `<iframe>` code
3. Paste in "Video URL or Embed Code" field

**Result**: System converts URL to embedded player

---

### Adding Notes/Materials

**Step 1**: Prepare Notes
- PDF file on Google Drive
- Google Doc with notes
- Dropbox PDF link
- OneDrive document

**Step 2**: Get Share Link
1. Right-click file → Share
2. Set to "Anyone with the link"
3. Copy the link

**Step 3**: Add to Course
1. Go to Admin Courses
2. Click "Add Course" or "Edit Course"
3. Paste link in "Notes/PDF URL" field
4. Click Save/Create

**Example URLs:**
- `https://drive.google.com/file/d/FILE_ID/view`
- `https://docs.google.com/document/d/DOC_ID/edit`
- `https://drive.google.com/file/d/FILE_ID/view?usp=share_link`

**Result**: When user clicks "View Notes" → Opens in new tab

---

## User Experience Flow

### Student Perspective

**1. Browse Courses**
```
Student → All Courses page
    ↓
Sees course cards with images
    ↓
Clicks on course → Goes to Course Detail page
```

**2. Before Enrollment**
```
Course Detail page shows:
- Course title
- Course description
- Course thumbnail
- "Enroll Now" button
- Benefits list:
  ✓ Full course videos and materials
  ✓ Course notes and downloads
  ✓ Final exam to earn certificate
  ✓ Progress tracking
```

**3. Click "Enroll Now"**
```
Button shows "Enrolling..." (loading state)
    ↓
Database records enrollment
    ↓
Page refreshes
    ↓
Full course content now visible
```

**4. After Enrollment**
```
Student sees:
- Video player with iframe (top)
- Three tabs:
  • Overview (course info + download notes)
  • Notes (download link)
  • Exam (exam info + start button)
- Sidebar:
  • "You're enrolled!" badge
  • Course info
  • Action buttons
```

**5. Watch Video**
- Fullscreen capable
- Pause/play controls
- YouTube or Drive player

**6. Access Notes**
- Click "View Notes" button
- Opens PDF/Doc in new tab
- Can download or read online

**7. Start Exam**
- Click "Start Exam" button
- Goes to exam page
- 25+ questions
- 70% to pass
- Earns certificate

---

## What Happens in Each Tab

### Overview Tab
```
Shows:
- Course title
- Course description
- Two action buttons:
  • "View Notes" → switches to notes tab
  • "Start Exam" → goes to exam page
```

### Notes Tab
```
If notes_url exists:
  Shows:
  - "Download course notes and materials" message
  - "Open/Download Notes" button
  - Button link points to notes_url
  - Opens in new tab (Google Doc, PDF, etc.)

If notes_url is empty:
  Shows:
  - "No notes available for this course yet"
  - "Admin will add materials soon"
```

### Exam Tab
```
Shows:
- "Final Exam" heading
- Description of exam
- Exam rules:
  • Minimum 70% required to pass
  • All questions must be answered
  • Can review before submitting
- "Start Exam" button (orange)
- Opens exam in exam page
```

---

## Database Fields Required

For courses to work properly, these columns must exist:

```sql
courses (
  id: bigint,
  title: text (required) - Course name
  category: text (required) - Programming, Web, etc.
  description: text - Course overview
  video_url: text - YouTube URL or iframe code
  notes_url: text - PDF/Doc link for download
  thumbnail_url: text - Course card image
  is_active: boolean - Whether visible to students
  created_at: timestamp
)

enrollments (
  id: bigint,
  student_id: uuid - Who enrolled
  course_id: bigint - Which course
  progress: integer - 0-100
  completed: boolean
  created_at: timestamp
)
```

---

## Video URL Examples

### Google Drive Iframe (Recommended)
```html
<iframe src="https://drive.google.com/file/d/1A2B3C4D5E6F/preview" width="640" height="480" allow="autoplay"></iframe>
```
✅ Works great
✅ Full embed
✅ Reliable

### YouTube URL
```
https://www.youtube.com/watch?v=dQw4w9WgXcQ
```
✅ Simple format
✅ Auto-converts to embed
✅ Good performance

### YouTube Iframe
```html
<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" width="640" height="480" allow="autoplay"></iframe>
```
✅ Explicit embed
✅ Full control
✅ Preferred format

---

## Notes URL Examples

### Google Drive PDF
```
https://drive.google.com/file/d/1A2B3C4D5E6F/view
```

### Google Doc
```
https://docs.google.com/document/d/1A2B3C4D5E6F/edit?usp=sharing
```

### Dropbox
```
https://www.dropbox.com/s/abc123/notes.pdf?dl=0
```

### Direct PDF Link
```
https://example.com/course-notes.pdf
```

---

## Troubleshooting

### Video Not Showing
**Problem**: Black player but no video
**Solution**:
- Check video_url field isn't empty
- If using iframe, make sure entire code is pasted (include `<` and `>`)
- If using URL, ensure it's complete: `https://www.youtube.com/watch?v=...`
- Try refreshing page

### Notes Not Opening
**Problem**: Clicking "View Notes" doesn't work
**Solution**:
- Check notes_url field isn't empty
- Check link is valid (try pasting in browser)
- For Drive files, ensure "Anyone with the link" access
- Should open in new tab (check pop-up blocker)

### Enrollment Not Working
**Problem**: "Enroll Now" button not working
**Solution**:
- Check user is premium (show premium lock if not)
- Check enrollments table exists in database
- Check student_id is correct
- Check course_id is correct

### Course Not Loading
**Problem**: "Course not found" message
**Solution**:
- Check course exists in database
- Check course ID is correct
- Verify course is active (is_active = true)

---

## Admin Checklist for Course Setup

Before publishing a course:

- [ ] Course title filled in
- [ ] Category selected
- [ ] Description written
- [ ] Thumbnail image URL added
- [ ] Video URL or iframe code pasted
- [ ] Notes URL added (if applicable)
- [ ] Course saved in database
- [ ] Default exam created (auto)
- [ ] Exam questions added
- [ ] Course tested by viewing as premium user
- [ ] Test enrollment process
- [ ] Test video playback
- [ ] Test notes download/access
- [ ] Test exam access

---

## Features

### Video Player
- ✅ Google Drive iframe support
- ✅ YouTube URL auto-detection
- ✅ YouTube iframe support
- ✅ Fullscreen capable
- ✅ Auto-sizing
- ✅ Fallback message if no video

### Notes System
- ✅ Google Drive PDF download
- ✅ Google Docs link
- ✅ Dropbox support
- ✅ Direct PDF links
- ✅ Opens in new tab
- ✅ Fallback if no notes

### Enrollment
- ✅ Required before accessing content
- ✅ Prevents accidental access
- ✅ Shows benefits before enrolling
- ✅ One-click enrollment
- ✅ Instant activation
- ✅ Database tracking

### UI/UX
- ✅ Loading states
- ✅ Error messages
- ✅ Clear call-to-action buttons
- ✅ Responsive design
- ✅ Mobile-friendly
- ✅ Accessible buttons/links

---

## Version History

**v2.0** - Current
- Enrollment requirement added
- Iframe video player
- Notes system with download links
- Database integration
- Better UI/UX

**v1.0** - Previous
- Static course details
- No enrollment tracking
- Sample video placeholder
- No notes system
