import { supabase } from '../supabaseClient';

const isMissingColumnError = (error, columnName) =>
  String(error?.message || '').toLowerCase().includes(String(columnName || '').toLowerCase());

const pushNotification = async (payload) => {
  try {
    const { error } = await supabase.from('admin_notifications').insert(payload);
    if (error && String(error.message || '').includes('target_user_id')) {
      const { target_user_id, ...fallback } = payload;
      const marker = target_user_id ? `[target_user_id:${target_user_id}] ` : '';
      await supabase.from('admin_notifications').insert({
        ...fallback,
        content:
          marker && !String(fallback.content || '').includes('[target_user_id:')
            ? `${marker}${fallback.content || ''}`
            : fallback.content,
      });
    }
  } catch {
    // Notifications are best-effort only.
  }
};

const formatDeviceLine = (label, fallback) => label || fallback || 'Unknown device';

export const reportMultiSessionViolation = async (userProfile, conflictMeta = {}) => {
  if (!userProfile?.id || !userProfile?.role) {
    return {
      count: 1,
      userMessage:
        'More than one active session was detected. Reported to admin. If it happens again, your account can be deactivated.',
    };
  }

  const timestamp = new Date().toISOString();
  const fullName = userProfile.full_name || userProfile.email || 'User';
  let violationCount = Number(userProfile.session_violation_count || 0) + 1;

  try {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        session_violation_count: violationCount,
        session_violation_last_at: timestamp,
      })
      .eq('id', userProfile.id);

    if (updateError && !isMissingColumnError(updateError, 'session_violation_count')) {
      throw updateError;
    }
  } catch {
    violationCount = Number(userProfile.session_violation_count || 0) + 1;
  }

  const isRepeatOffense = violationCount >= 2;
  const previousDevice = formatDeviceLine(
    conflictMeta?.existingDeviceLabel,
    conflictMeta?.existingDeviceId
  );
  const newDevice = formatDeviceLine(
    conflictMeta?.incomingDeviceLabel,
    conflictMeta?.incomingDeviceId
  );
  const mobileNumber = userProfile.phone || userProfile.mobile || 'Not available';
  const email = userProfile.email || 'Not available';
  const subject = isRepeatOffense
    ? `Repeated multiple-session plagiarism detected for ${fullName}`
    : `Multiple-session plagiarism detected for ${fullName}`;
  const description = isRepeatOffense
    ? `Repeated multi-session plagiarism detected for ${fullName}.

Name: ${fullName}
Role: ${userProfile.role}
Email: ${email}
Mobile: ${mobileNumber}
Existing logged-in device: ${previousDevice}
New detected device: ${newDevice}
Previous session seen at: ${conflictMeta?.existingUpdatedAt || 'Unknown'}
Violation count: ${violationCount}

This is the second time more than one active session was detected for this account. Admin can disable the account now if needed.`
    : `Multi-session plagiarism detected for ${fullName}.

Name: ${fullName}
Role: ${userProfile.role}
Email: ${email}
Mobile: ${mobileNumber}
Existing logged-in device: ${previousDevice}
New detected device: ${newDevice}
Previous session seen at: ${conflictMeta?.existingUpdatedAt || 'Unknown'}
Violation count: ${violationCount}

Reported automatically to admin. If repeated again, the account can be deactivated.`;
  const userMessage = isRepeatOffense
    ? 'More than one active session plagiarism detected again and reported to admin. Repeated activity can lead to account deactivation.'
    : 'More than one active session plagiarism detected and reported to admin. If repeated again, your account can be deactivated.';

  try {
    await supabase.from('issue_reports').insert({
      reporter_id: userProfile.id,
      reporter_role: userProfile.role,
      category: 'account',
      subject,
      description,
    });
  } catch {
    // Best effort: admin notification below still provides visibility.
  }

  await pushNotification({
    title: isRepeatOffense ? 'Repeated Multi-Session Alert' : 'Multi-Session Alert',
    content: description,
    type: isRepeatOffense ? 'error' : 'warning',
    target_role: 'admin',
    target_user_id: null,
  });

  await pushNotification({
    title: isRepeatOffense ? 'Repeated Session Violation' : 'Session Violation Warning',
    content: userMessage,
    type: isRepeatOffense ? 'error' : 'warning',
    target_role: 'all',
    target_user_id: userProfile.id,
  });

  return {
    count: violationCount,
    userMessage,
    adminMessage: description,
  };
};
