# Account Management Features - Implementation Guide

## Overview
Added admin capabilities to temporarily disable and permanently delete user accounts in the Account Management dashboard.

## Features Implemented

### 1. **Temporary Account Disable**
- Admins can temporarily disable user accounts without deletion
- Disabled users cannot login or access courses
- Accounts can be re-enabled anytime
- Visual indicator shows account status (Active/Disabled)

**Action Button:** "Disable" (orange button with AlertTriangle icon)
**Reversible:** ✅ Yes - can be re-enabled with "Enable" button

### 2. **Permanent Account Deletion**
- Admins can permanently delete user accounts
- Requires name confirmation to prevent accidental deletion
- Shows strong warning about irreversible action
- Deleted data cannot be recovered

**Action Button:** "Delete" (red button with Trash icon)
**Reversible:** ❌ No - permanent action
**Confirmation:** Requires typing user's full name exactly

## Database Changes

### Schema Update
Added `is_disabled` boolean column to `profiles` table:
```sql
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_disabled boolean default false;
```

**File:** `add_is_disabled.sql` - Migration script for existing deployments

## UI Components

### Account Status Column (New)
Shows whether account is "Active" or "Disabled":
- Green badge: Active account
- Red badge: Disabled account

### Action Buttons (New)
Added two new action buttons to user cards:
1. **Disable/Enable** - Toggle account access (orange/blue button)
2. **Delete** - Permanently remove account (red button)

### Modal Dialogs (Updated)
Enhanced modal with support for:
- **Disable Action** - Shows warning that user cannot login
- **Enable Action** - Confirms account re-activation
- **Delete Action** - Requires name confirmation + strong warning

## Functionality

### Disable Account Flow
1. Admin clicks "Disable" button on user card
2. Modal shows confirmation with warning
3. Click "Confirm" to disable account
4. User receives success notification
5. Account status updates to "Disabled"
6. Disabled user can be re-enabled anytime

### Delete Account Flow
1. Admin clicks "Delete" button on user card
2. Modal shows critical warning about permanent deletion
3. Admin must type user's full name exactly to enable delete button
4. Click red "Confirm" button to permanently delete
5. Account and all associated data are removed
6. Success notification shown
7. User removed from table

## State Management

New state variables added:
- `deleteConfirm` - Tracks confirmation text input for delete action

## Action Types Updated
```javascript
// Existing
'unlock', 'lock', 'grant-premium', 'revoke-premium'

// New
'disable', 'enable', 'delete'
```

## Backend Operations

### Disable Account
```javascript
const updatePayload = { is_disabled: true };
// Updates profiles table
```

### Enable Account
```javascript
const updatePayload = { is_disabled: false };
// Updates profiles table
```

### Delete Account
```javascript
// Permanently deletes from profiles table
// Cascade deletes related records via foreign keys
await supabase.from('profiles').delete().eq('id', selectedUser.id);
```

## Files Modified

1. **src/pages/AccountManagement.jsx**
   - Added `deleteConfirm` state
   - Added `disable`, `enable`, `delete` action handlers in `executeAction()`
   - Added account status column to table
   - Added Disable/Enable and Delete buttons to user actions
   - Enhanced modal with new action dialogs
   - Added name confirmation input for delete action

2. **db_schema.sql**
   - Added `is_disabled boolean default false` to profiles table

3. **add_is_disabled.sql** (New)
   - Migration script for adding column to existing deployments

## Security Considerations

✅ Delete action requires name confirmation to prevent accidental deletion
✅ Strong visual warning for permanent delete action
✅ Red-colored delete button for danger indication
✅ Disable action is reversible for safety
✅ All actions logged via AlertModal feedback

## Testing Checklist

- [ ] Disable account: User cannot login after disabling
- [ ] Enable account: User can login after enabling
- [ ] Delete account: Account completely removed from system
- [ ] Delete confirmation: Delete only works with exact name match
- [ ] UI updates: Table refreshes after each action
- [ ] Error handling: Errors shown in AlertModal
- [ ] Multiple actions: Can perform multiple actions in sequence

## Admin Workflow

### Managing Problem Accounts
1. Lock account for 60 days → Disable → Delete (escalation)
2. Or disable temporarily while investigating issues
3. Re-enable if issues resolved

### User Offboarding
1. Disable account to prevent access
2. Export data if needed
3. Permanently delete when retention period complete

## Notes

- Disabled accounts still exist in database (soft delete approach)
- Use disable for temporary suspension, delete for permanent removal
- All actions require admin role (enforced by page access)
- Database uses UUID primary keys for data integrity
