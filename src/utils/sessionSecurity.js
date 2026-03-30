import { supabase } from '../supabaseClient';

const isMissingColumnError = (error, columnName) =>
  String(error?.message || '').toLowerCase().includes(String(columnName || '').toLowerCase());

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
    await supabase.from('multi_session_alerts').insert({
      user_id: userProfile.id,
      full_name: fullName,
      email,
      phone: mobileNumber,
      user_role: userProfile.role,
      existing_device_label: previousDevice,
      new_device_label: newDevice,
      existing_updated_at: conflictMeta?.existingUpdatedAt || null,
      violation_count: violationCount,
      is_repeat_offense: isRepeatOffense,
      admin_status: 'new',
    });
  } catch {
    // Best effort only.
  }

  return {
    count: violationCount,
    userMessage,
    adminMessage: description,
  };
};
