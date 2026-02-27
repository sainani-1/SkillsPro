# Course Management Guide

## Overview
The Admin Courses page now supports creating new courses with images and Drive iframe videos, and deleting existing courses.

## Features Added

### 1. **Create New Course**
- Click the "**Add New Course**" button at the top of the Admin Courses page
- A modal form will appear with the following fields:

#### Required Fields:
- **Course Title** * - e.g., "Introduction to Python Programming"
- **Category** * - e.g., "Programming", "Web Development", "Data Science"

#### Optional Fields:
- **Description** - Course overview, what students will learn
- **Image URL** - Direct image URL or Google Drive shared link
- **Video URL or Embed Code** - YouTube URL OR Google Drive iframe embed code
- **Notes/PDF URL** - Link to course materials

#### How to Add Google Drive Video:
1. Upload your video to Google Drive
2. Right-click the video → **Share** → Change to "Anyone with the link"
3. Click **More options** (3 dots) → **Embed item**
4. Copy the entire `<iframe>` tag code
5. Paste it in the "Video URL or Embed Code" field

**Example iframe code:**
```html
<iframe src="https://drive.google.com/file/d/YOUR_FILE_ID/preview" width="640" height="480" allow="autoplay"></iframe>
```

### 2. **Edit Existing Course**
- Click "**Details**" button on any course card
- Update any field including:
  - Title, Category, Description
  - **Course Image URL** - Add or change course image
  - **Video URL or Embed Code** - Supports YouTube or Drive iframes
  - Notes URL
- Click "**Save Course**" to update

### 3. **Delete Course**
- Click the red "**Delete**" button on any course card
- A confirmation modal will appear showing:
  - Course title being deleted
  - Warning that this action cannot be undone
  - All related exams, questions, and student submissions will be deleted
- Click "**Delete Course**" to confirm or "**Cancel**" to abort

## Database Schema

The courses table uses `thumbnail_url` for images:

```sql
create table courses (
  id bigserial primary key,
  title text not null,
  description text,
  category text not null,
  thumbnail_url text,  -- For course images
  video_url text,      -- For YouTube URLs or iframe embeds
  notes_url text,
  is_active boolean default true,
  created_at timestamptz default now()
);
```

## Important Notes

### Video Field (`video_url`):
- Accepts both YouTube URLs and Drive iframe HTML
- For Drive videos: Paste the ENTIRE `<iframe>` tag (not just the URL)
- The system will automatically detect and render iframes properly

### Image Field (`thumbnail_url`):
- Direct image URLs work best
- Google Drive images: Use shared link (Make sure it's set to "Anyone with the link")
- Supported formats: JPG, PNG, GIF, WebP

### Delete Safety:
- Deleting a course is permanent
- Cascade deletes:
  - All exam questions for that course
  - All student exam submissions
  - The course exam
  - The course itself
- Always confirm before deleting

## Access Control
- Only **Admins** can access the Admin Courses page
- Only Admins can create, edit, or delete courses
- Students and Teachers cannot modify courses

## Common Issues & Solutions

### Issue: Video not displaying
**Solution:** 
- For Drive videos, make sure to:
  1. Share the video as "Anyone with the link"
  2. Use the embed code, not the sharing link
  3. Copy the ENTIRE `<iframe>` tag including `<` and `>`

### Issue: Image not showing
**Solution:**
- Verify the image URL is publicly accessible
- For Drive images, use the direct share link
- Check if the URL starts with `https://`

### Issue: Delete not working
**Solution:**
- Check browser console for errors
- Verify you're logged in as an admin
- Ensure the course exists in the database

## UI/UX Features

### New Course Modal:
- Clean, modern design with proper spacing
- Field labels with required indicators (*)
- Helpful placeholder text and hints
- Cancel and Create buttons
- Auto-closes on successful creation

### Delete Confirmation Modal:
- Red warning theme
- Shows course title being deleted
- Clear warning about permanent deletion
- Cancel and Delete buttons
- Auto-closes after deletion

### Course Cards:
- Delete button with red styling (trash icon)
- Details button with blue styling (edit icon)
- Expandable view for course details
- Shows course ID and category

## Testing Checklist

- [ ] Create new course with all fields
- [ ] Create new course with only required fields
- [ ] Upload YouTube video URL
- [ ] Upload Google Drive iframe embed
- [ ] Add course image from URL
- [ ] Edit existing course
- [ ] Delete course and verify cascade delete
- [ ] Cancel create/delete operations
- [ ] Verify validation (missing title/category)

## Future Enhancements

Possible additions:
- Image upload directly to Supabase storage
- Video upload to Supabase storage
- Course preview before creation
- Bulk course import/export
- Course duplication feature
- Course analytics (views, completions)
