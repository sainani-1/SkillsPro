# Fix: Account Management Delete/Disable Not Working

## Problem
When clicking "Delete" or "Disable" buttons in Account Management, the operation appears to succeed (no error shown) but the account is not actually updated or deleted.

## Root Cause
**Supabase Row Level Security (RLS) policies** are blocking admin operations. By default, RLS policies only allow users to manage their own profiles. Admins need specific policies to manage all accounts.

## Solution

### Step 1: Run RLS Policy Migration
Execute the SQL in `add_admin_rls_policies.sql` in your Supabase SQL Editor:

1. Go to Supabase Dashboard → Your Project → SQL Editor
2. Create a new query
3. Copy and paste the contents of `add_admin_rls_policies.sql`
4. Click "Run"

**What these policies do:**
- ✅ Allow admins to **view** all user profiles
- ✅ Allow admins to **update** any user profile (disable/enable/lock/unlock)
- ✅ Allow admins to **delete** user profiles
- ✅ Allow users to view/update only their own profile
- ❌ Prevent users from deleting their own accounts

### Step 2: Verify in Browser Console
The code now includes detailed logging. Check browser console (F12 → Console tab):

**Successful delete should show:**
```
Attempting to delete user: <uuid>
Delete successful
```

**Successful disable should show:**
```
Executing action: disable with payload: {is_disabled: true}
```

**If operations fail, you'll see errors like:**
```
Delete error: PostgreSQL policy violation
Update error: permission denied
```

## Implementation Files

### SQL Migration Files
- `add_admin_rls_policies.sql` - **REQUIRED** RLS policies for admin access
- `add_is_disabled.sql` - Database column for disable feature
- `db_schema.sql` - Updated schema with `is_disabled` column

### Updated Code
- `src/pages/AccountManagement.jsx` - Added delete/disable actions with error logging

## Quick Verification Checklist

After running the SQL:
- [ ] Run the `add_admin_rls_policies.sql` migration
- [ ] Check browser console (F12) for error messages
- [ ] Try disabling a test account
- [ ] Verify in Supabase: Account shows `is_disabled = true`
- [ ] Try deleting a test account
- [ ] Verify in Supabase: Account is completely removed from profiles table

## Troubleshooting

### Still Getting Errors?

**Error: "new row violates row-level security policy"**
- RLS policies haven't been applied
- **Fix:** Run `add_admin_rls_policies.sql`

**Error: "permission denied for table profiles"**
- User account doesn't have admin role
- **Fix:** Verify logged-in user has `role = 'admin'` in profiles table

**Error: "column is_disabled does not exist"**
- Database schema wasn't updated
- **Fix:** Run `add_is_disabled.sql` migration

**Button shows loading but nothing happens**
- Check browser console (F12 → Console)
- Look for error messages starting with "Delete error:" or "Update error:"
- Copy the error message for debugging

## Testing Steps

1. **Test Disable:**
   - Click "Disable" button on a user
   - Modal appears → Click "Confirm"
   - Success message shows
   - Go to Supabase → profiles table → Find user → `is_disabled` should be `true`

2. **Test Enable:**
   - Click "Enable" button on disabled user
   - Modal appears → Click "Confirm"
   - Success message shows
   - `is_disabled` should be `false`

3. **Test Delete:**
   - Click "Delete" button on a user
   - Modal appears with warning
   - Type exact user name
   - Click red "Confirm" button
   - Success message shows
   - Go to Supabase → profiles table → User should be gone

## Technical Details

### What Changed in Code
- Added `deleteConfirm` state for name confirmation
- Added delete action handler with console logging
- Added disable/enable action handlers
- Enhanced modal with delete confirmation UI
- All operations now log to console for debugging

### Database Changes
- Added `is_disabled` boolean column to profiles (default: false)
- Added RLS policies to allow admin operations

### Authentication
- Only users with `role = 'admin'` can:
  - View all profiles
  - Update any profile
  - Delete profiles
- Regular users can only manage their own profile

## Prevention Tips

For future admin features:
1. Always check if RLS policies allow the operation
2. Add admin-specific policies for any admin-only actions
3. Include error logging in sensitive operations
4. Test delete operations carefully in dev environment first
