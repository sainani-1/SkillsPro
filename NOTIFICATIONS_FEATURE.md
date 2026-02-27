# Notifications System Implementation

## Overview
Admin can post notifications that are visible to all teachers and students in a dedicated Notifications tab/page.

## Database Schema
Added two new tables to track notifications:

### `admin_notifications` table
- `id` (bigserial) - Primary key
- `admin_id` (uuid) - References admin who posted
- `title` (text) - Notification title
- `content` (text) - Notification content
- `type` (text) - info|warning|success (default: info)
- `target_role` (text) - all|student|teacher (default: all)
- `created_at` (timestamptz) - Auto timestamp
- `updated_at` (timestamptz) - Auto timestamp

### `notification_reads` table
- `id` (bigserial) - Primary key
- `notification_id` (bigint) - FK to admin_notifications
- `user_id` (uuid) - FK to profiles
- `read_at` (timestamptz) - When user read it
- `unique(notification_id, user_id)` - One read record per user per notification

## Features Implemented

### 1. Admin Notifications Page (`/app/admin/notifications`)
**Location:** `src/pages/AdminNotifications.jsx`

**Features:**
- Post new notifications with title, content, type (info/warning/success), target (all users/students/teachers)
- Edit existing notifications
- Delete notifications
- View all posted notifications in reverse chronological order
- See notification details with colored badges
- Status colors: Blue (info), Yellow (warning), Green (success)

**Form Fields:**
- Title (required)
- Content (required, textarea)
- Type dropdown (info, warning, success)
- Target Role dropdown (all users, students only, teachers only)

### 2. User Notifications Page (`/app/notifications`)
**Location:** `src/pages/Notifications.jsx`

**Features:**
- View all notifications relevant to user's role
- Auto-filter: Students see "student" + "all" notifications
- Auto-filter: Teachers see "teacher" + "all" notifications
- Mark notifications as read by clicking them
- Visual read/unread indicators (blue dot for unread, checkmark for read)
- Shows unread count in header
- Color-coded notification types with descriptions
- Timestamp for each notification
- Responsive card layout

**Read Tracking:**
- Uses `notification_reads` table to track which users have read notifications
- Read status is synced in real-time
- Visual feedback with checkmark icon when read

### 3. Navigation Updates
**Sidebar Changes:**
- Added Bell icon import from lucide-react
- Added "Notifications" link for all users (students, teachers, admins)
- Added "Post Notifications" admin-only link in admin section
- Both links appear in the sidebar navigation menu

**Routes Added in `App.jsx`:**
- `/app/notifications` - User notifications view (for all authenticated users)
- `/app/admin/notifications` - Admin notification posting/management (admin-only)

## Database Migration
Run this SQL in Supabase SQL Editor to create the tables:

```sql
-- Admin notifications
create table if not exists admin_notifications (
  id bigserial primary key,
  admin_id uuid references profiles(id),
  title text not null,
  content text not null,
  type text default 'info', -- info|warning|success
  target_role text default 'all', -- all|student|teacher
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists notification_reads (
  id bigserial primary key,
  notification_id bigint references admin_notifications(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  read_at timestamptz default now(),
  unique (notification_id, user_id)
);

-- Optional: Create RLS policies for security
alter table admin_notifications enable row level security;
alter table notification_reads enable row level security;

-- Admins can insert notifications
create policy "admin_create_notifications" on admin_notifications
  for insert with check (exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  ));

-- Everyone can read notifications based on their role
create policy "users_read_notifications" on admin_notifications
  for select using (
    target_role = 'all' or
    target_role = (select role from profiles where id = auth.uid())
  );

-- Everyone can mark notifications as read
create policy "users_mark_read" on notification_reads
  for insert with check (auth.uid() = user_id);

create policy "users_view_reads" on notification_reads
  for select using (auth.uid() = user_id);
```

## UI/UX Details

### Admin View (AdminNotifications.jsx)
- **Header:** "Admin Notifications" with Bell icon and unread count
- **Form Section:** Clean form with all fields and submit button
- **List Section:** Shows all notifications in cards with:
  - Type badge (colored: info/warning/success)
  - Target role label
  - Title in bold
  - Content preview
  - Timestamp
  - Edit/Delete buttons
- **Edit Flow:** Click edit button → form pre-fills → can update and click "Update"
- **Delete Flow:** Confirmation dialog before deletion

### User View (Notifications.jsx)
- **Header:** "Notifications" with Bell icon and unread count badge (red)
- **Empty State:** Bell icon + message if no notifications
- **Notification Cards:**
  - Type badge (colored)
  - Blue dot indicator if unread
  - Title and content
  - Timestamp
  - Checkmark icon if read
  - Click to mark as read (shows confirmation with color change)
- **Responsive:** Works on mobile and desktop
- **Auto-filtering:** Only shows relevant notifications based on user's role

## File Changes Summary
1. **db_schema.sql** - Added admin_notifications and notification_reads tables
2. **src/pages/AdminNotifications.jsx** - New file for admin posting
3. **src/pages/Notifications.jsx** - New file for user viewing
4. **src/components/Sidebar.jsx** - Added Bell icon and notification links
5. **src/App.jsx** - Added two new routes with AdminRoute/ProtectedRoute wrappers

## Usage Flow

### Admin Posting:
1. Go to Admin Panel → "Post Notifications"
2. Fill in title, content, select type and target
3. Click "Post Notification"
4. Notification appears instantly in the list
5. Can edit or delete later

### User Viewing:
1. Go to "Notifications" from sidebar
2. See all notifications for their role
3. Click any notification to mark as read
4. Unread count updates in real-time
5. See read checkmark on viewed notifications

## Future Enhancements
- Push notifications (browser/email)
- Notification scheduling (post for future date)
- Rich text editor for content
- File attachments
- Analytics on notification views
- Bulk actions (delete multiple)
- Search/filter by type, date range
