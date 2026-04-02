import { sendAdminNotification } from './adminNotifications';

export const ID_VERIFICATION_STATUS = {
  NOT_SUBMITTED: 'not_submitted',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

export const NAME_CHANGE_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

export const GOVERNMENT_ID_OPTIONS = [
  'Aadhaar Card',
  'PAN Card',
  'Voter ID',
  'Driving Licence',
  'Passport',
  'Student ID + Government ID',
];

export const getCertificateDisplayName = (source, options = {}) => {
  const {
    placeholder = '-',
    requireApproved = true,
  } = options;
  const status = String(
    source?.identity_verification_status ||
      source?.status ||
      ''
  ).trim().toLowerCase();
  const isApproved =
    status === ID_VERIFICATION_STATUS.APPROVED ||
    (!requireApproved && Boolean(source?.certificate_name || source?.approved_name || source?.full_name));

  if (!isApproved) return placeholder;

  return (
    String(
      source?.certificate_name ||
        source?.approved_name ||
        source?.full_name ||
        ''
    ).trim() || placeholder
  );
};

export const getIdentityVerificationStatus = (profile, latestRequest = null) => {
  if (latestRequest?.status) return latestRequest.status;
  const raw = String(profile?.identity_verification_status || '').trim().toLowerCase();
  if (raw === ID_VERIFICATION_STATUS.PENDING) return ID_VERIFICATION_STATUS.PENDING;
  if (raw === ID_VERIFICATION_STATUS.APPROVED) return ID_VERIFICATION_STATUS.APPROVED;
  if (raw === ID_VERIFICATION_STATUS.REJECTED) return ID_VERIFICATION_STATUS.REJECTED;
  return ID_VERIFICATION_STATUS.NOT_SUBMITTED;
};

export const hasApprovedIdentity = (profile, latestRequest = null) =>
  getIdentityVerificationStatus(profile, latestRequest) === ID_VERIFICATION_STATUS.APPROVED;

export async function fetchLatestIdentityVerification(supabase, userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('student_id_verifications')
    .select(`
      id,
      user_id,
      submitted_name,
      approved_name,
      id_type,
      id_number,
      id_image_url,
      status,
      rejection_reason,
      assigned_verifier_id,
      reviewed_by,
      reviewed_at,
      created_at,
      updated_at,
      reviewer:profiles!student_id_verifications_reviewed_by_fkey(id, full_name, email),
      verifier:profiles!student_id_verifications_assigned_verifier_id_fkey(id, full_name, email)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function fetchLatestNameChangeRequest(supabase, userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('certificate_name_change_requests')
    .select(`
      id,
      user_id,
      current_name,
      requested_name,
      reason,
      status,
      admin_notes,
      reviewed_by,
      reviewed_at,
      created_at,
      updated_at,
      reviewer:profiles!certificate_name_change_requests_reviewed_by_fkey(id, full_name, email)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function pickLeastBusyVerifier(supabase) {
  const { data: verifiers, error: verifierError } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('role', 'verifier')
    .order('full_name', { ascending: true });

  if (verifierError) throw verifierError;
  if (!verifiers?.length) return null;

  const { data: pendingRows, error: pendingError } = await supabase
    .from('student_id_verifications')
    .select('assigned_verifier_id, status')
    .eq('status', ID_VERIFICATION_STATUS.PENDING);

  if (pendingError) throw pendingError;

  const counts = new Map();
  (pendingRows || []).forEach((row) => {
    const key = row?.assigned_verifier_id;
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return [...verifiers].sort((a, b) => {
    const aCount = counts.get(a.id) || 0;
    const bCount = counts.get(b.id) || 0;
    if (aCount !== bCount) return aCount - bCount;
    return String(a.full_name || '').localeCompare(String(b.full_name || ''));
  })[0];
}

export async function submitIdentityVerification({
  supabase,
  userId,
  submittedName,
  idType,
  idNumber,
  idImageUrl,
}) {
  const assignedVerifier = await pickLeastBusyVerifier(supabase);
  const now = new Date().toISOString();

  const payload = {
    user_id: userId,
    submitted_name: submittedName,
    id_type: idType,
    id_number: idNumber,
    id_image_url: idImageUrl,
    status: ID_VERIFICATION_STATUS.PENDING,
    rejection_reason: null,
    assigned_verifier_id: assignedVerifier?.id || null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from('student_id_verifications')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      identity_verification_status: ID_VERIFICATION_STATUS.PENDING,
      identity_submitted_at: now,
      identity_rejection_reason: null,
      identity_id_number: idNumber,
      updated_at: now,
    })
    .eq('id', userId);

  if (profileError) throw profileError;

  await sendAdminNotification({
    title: 'New ID Verification Request',
    content: assignedVerifier?.id
      ? `${submittedName} submitted a government ID verification request.`
      : `${submittedName} submitted a government ID verification request. No verifier is assigned yet.`,
    type: 'info',
    target_role: assignedVerifier?.id ? 'verifier' : 'admin',
    target_user_id: assignedVerifier?.id || null,
  });

  if (assignedVerifier?.id) {
    await sendAdminNotification({
      title: 'Review Needed',
      content: `${submittedName} was assigned to you for ID verification review.`,
      type: 'info',
      target_role: 'verifier',
      target_user_id: assignedVerifier.id,
    });
  }

  return data;
}

export async function submitCertificateNameChangeRequest({
  supabase,
  userId,
  currentName,
  requestedName,
  reason,
}) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('certificate_name_change_requests')
    .insert({
      user_id: userId,
      current_name: currentName,
      requested_name: requestedName,
      reason,
      status: NAME_CHANGE_STATUS.PENDING,
      admin_notes: null,
      reviewed_by: null,
      reviewed_at: null,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single();

  if (error) throw error;

  await sendAdminNotification({
    title: 'Certificate Name Change Request',
    content: `${currentName} requested a certificate name change to "${requestedName}".`,
    type: 'info',
    target_role: 'admin',
  });

  return data;
}
