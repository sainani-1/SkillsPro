# Admin Features Update - Registration Pause & Direct User Addition

## Overview
Two new admin features have been implemented to give platform administrators control over registrations and user onboarding.

---

## Feature 1: Pause/Resume Registrations

### What It Does
Admins can pause new user registrations, showing a locked message to visitors trying to sign up.

### Components Updated

#### 1. **AdminSettings.jsx** ✅ (Already Completed)
- Added `registrationPaused` state
- Toggle checkbox: "Pause Registrations" with 🔒 lock icon
- Loads `registration_paused` setting from database on mount
- Saves setting to `settings` table (key: 'registration_paused', value: 'true'/'false')
- Shows status in summary: "🔒 Paused" or "✓ Open"

#### 2. **Register.jsx** ✅ (Just Updated)
- Added `useEffect` hook to check `registration_paused` setting on component mount
- If paused (`value === 'true'`):
  - Shows locked message with 🔒 emoji
  - Message: "Registrations are temporarily paused. Please try again later."
  - Provides link back to login page
  - Hides the registration form entirely
- If open:
  - Shows normal registration form as usual

**Code Added:**
```jsx
// Check if registrations are paused
useEffect(() => {
  const checkRegistrationStatus = async () => {
    try {
      const { data } = await supabase
        .from('settings')
        .select('key, value')
        .eq('key', 'registration_paused')
        .single();
      
      if (data && data.value === 'true') {
        setRegistrationPaused(true);
      }
    } catch (error) {
      console.log('Settings check:', error.message);
    }
  };
  
  checkRegistrationStatus();
}, []);
```

### How to Use
1. **Admin Side:** Go to Admin Settings → Check "Pause Registrations" → Click Save
2. **User Side:** Try to visit `/register` → See "Registrations Paused" message
3. **Resume:** Admin unchecks the toggle → Form becomes visible again immediately

---

## Feature 2: Add Users Directly

### What It Does
Admins can create user accounts directly without requiring email signup. Useful for:
- Bulk onboarding teachers
- Adding students to the platform
- Creating admin accounts

### Components Updated

#### **UserManagementPage.jsx** ✅ (Just Updated)

**New Elements:**
1. **"Add User Directly" Button** - Green button in top-right of User Management page
2. **AddUserModal Component** - Modal dialog with form fields:
   - Email (required)
   - Full Name (required)
   - Phone (required)
   - Role: Student / Teacher / Admin (required)
   - Core Subject (shown only for Teachers)

**Form Behavior:**
- Validates all required fields before submission
- Shows error/success messages
- On success: Adds user to `profiles` table with default avatar
- Refreshes user list automatically
- Closes modal after 1.5 seconds

**Code Structure:**
```jsx
const AddUserModal = ({ onClose, onSuccess }) => {
    const [form, setForm] = useState({
        email: '',
        fullName: '',
        phone: '',
        role: 'student',
        coreSubject: 'Computer Science'
    });
    
    const handleSubmit = async (e) => {
        // Validates form
        // Inserts user to profiles table directly
        // Shows success/error messages
        // Calls onSuccess to refresh user list
    };
```

### How to Use
1. **Admin Side:** Go to User Management → Click "Add User Directly" button
2. **Fill Form:**
   - Email: User's email address
   - Full Name: User's full name
   - Phone: User's phone number
   - Role: Select student/teacher/admin
   - Subject: (If teacher) Select core subject
3. **Submit:** Click "Add User" → User appears in table immediately

### What Gets Created
- New record in `profiles` table with:
  - User email and name
  - Phone number
  - Selected role (student/teacher/admin)
  - Core subject (if teacher)
  - Default avatar URL
  - No authentication account created (users can set password later via "Forgot Password")

---

## Database Changes Required

Ensure the following columns exist in the `profiles` table:
- `email` (text) - User's email
- `full_name` (text) - User's full name
- `phone` (text) - User's phone number
- `role` (text) - 'student', 'teacher', or 'admin'
- `core_subject` (text, nullable) - For teachers
- `avatar_url` (text, nullable) - Profile picture

Ensure the `settings` table has a record with:
- `key`: 'registration_paused'
- `value`: 'true' or 'false'

---

## User Journey Examples

### Scenario 1: Pause Registrations During Maintenance
```
Admin visits AdminSettings
→ Checks "Pause Registrations" 
→ Clicks Save
→ User tries /register
→ Sees "🔒 Registrations Paused" message
→ Cannot signup
→ Admin unchecks toggle when ready
→ User refreshes /register
→ Form is available again
```

### Scenario 2: Bulk Add Teachers
```
Admin visits User Management
→ Clicks "Add User Directly"
→ Enters teacher email, name, phone
→ Selects "Teacher" role
→ Selects "Computer Science" subject
→ Clicks "Add User"
→ ✓ Teacher appears in user table
→ Teacher can login with "Forgot Password" to set password
→ Can immediately access teacher dashboard
```

---

## Testing Checklist

- [ ] Admin can toggle registration pause in AdminSettings
- [ ] When paused, /register shows locked message
- [ ] When unpaused, /register shows form
- [ ] Admin can open "Add User Directly" modal
- [ ] Can add student user successfully
- [ ] Can add teacher user with subject selection
- [ ] Can add admin user
- [ ] New users appear in user table immediately
- [ ] New users can login (via forgot password flow)
- [ ] Error handling works (invalid email, missing fields)

---

## Files Modified

1. **Register.jsx**
   - Added `useEffect` to check registration_paused setting
   - Added conditional UI for paused/open states
   - Import: Added `useEffect` to imports

2. **UserManagementPage.jsx**
   - Added `showAddUserModal` state
   - Added "Add User Directly" button
   - Created `AddUserModal` component with full form
   - Import: Added `X` icon from lucide-react

---

## Notes
- Users added directly do NOT have authentication accounts
- They can use "Forgot Password" to set a password and login
- No email verification required for directly-added users
- Admin can pause registrations at any time without affecting existing users
