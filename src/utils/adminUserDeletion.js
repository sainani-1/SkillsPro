import { supabase } from '../supabaseClient';

const buildDeleteReason = (user, sourceLabel) =>
  `Deleted by admin from ${sourceLabel} (${user?.email || user?.id || 'unknown-user'})`;

const softDeleteProfileFallback = async ({ user, adminUser, deleteReason, fallbackReason }) => {
  const deletedAt = new Date().toISOString();

  const { error: archiveError } = await supabase.from('deleted_accounts').insert({
    user_id: user.id,
    full_name: user.full_name || null,
    email: user.email || null,
    role: user.role || null,
    phone: user.phone || null,
    reason: `${deleteReason}. ${fallbackReason}`,
    deleted_by: adminUser?.id || null,
    deleted_at: deletedAt,
  });
  if (archiveError) throw archiveError;

  const { error: softDeleteError } = await supabase
    .from('profiles')
    .update({
      is_disabled: true,
      disabled_reason: 'Account deleted by admin (fallback soft delete).',
      deleted_at: deletedAt,
      deleted_reason: deleteReason,
      deleted_by: adminUser?.id || null,
      auth_user_id: null,
    })
    .eq('id', user.id);

  if (softDeleteError) throw softDeleteError;

  return {
    success: true,
    deleted: false,
    fallbackSoftDeleted: true,
    message: 'Hard delete was not available, so the profile was soft-deleted and login access was removed instead.',
  };
};

export const deleteUserFromAdmin = async ({ user, adminUser, sourceLabel = 'Admin Panel' }) => {
  const deleteReason = buildDeleteReason(user, sourceLabel);

  let fnData = null;
  let fnError = null;

  try {
    const result = await supabase.functions.invoke('admin-delete-user', {
      body: {
        user_id: user.auth_user_id || user.id,
        profile_id: user.id,
        reason: deleteReason,
      },
    });
    fnData = result.data;
    fnError = result.error;
  } catch (invokeError) {
    fnError = invokeError;
  }

  const functionFailed =
    !!fnError ||
    (fnData && typeof fnData === 'object' && fnData.success === false);

  if (functionFailed) {
    const fallbackReason = fnError?.message
      ? `Fallback soft delete used because delete function failed: ${fnError.message}`
      : `Fallback soft delete used because delete function failed: ${fnData?.message || 'unknown error'}`;

    return softDeleteProfileFallback({
      user,
      adminUser,
      deleteReason,
      fallbackReason,
    });
  }

  return fnData || {
    success: true,
    deleted: true,
    message: 'User deleted successfully.',
  };
};
