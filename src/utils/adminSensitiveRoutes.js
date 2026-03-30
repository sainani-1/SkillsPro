export const ADMIN_SENSITIVE_MFA_SETTINGS_KEY = 'admin_sensitive_mfa_paths';

const createRouteOption = (path, label, description) => ({
  path,
  label,
  description,
});

export const ADMIN_SENSITIVE_ROUTE_OPTIONS = [
  createRouteOption('/app/all-in-one', 'All In One', 'Unified live admin operations and monitoring view.'),
  createRouteOption('/app/live-exams', 'Live Exams', 'Admin live exam control center.'),
  createRouteOption('/app/live-exam-slots', 'Live Exam Slots', 'Slot scheduling and live exam timing controls.'),
  createRouteOption('/app/live-monitoring', 'Live Monitoring', 'Real-time exam session monitoring.'),
  createRouteOption('/app/live-attendance', 'Exam Attendance', 'Exam attendance review and tracking.'),
  createRouteOption('/app/faculty-attendance', 'Faculty Attendance', 'Faculty attendance and staffing records.'),
  createRouteOption('/app/live-alerts', 'Violation Alerts', 'Exam violations and risk alerts.'),
  createRouteOption('/app/live-messages', 'Exam Messages', 'Exam-related live messages and communication.'),
  createRouteOption('/app/live-cancellations', 'Live Slot Cancellations', 'Cancelled live sessions and slot actions.'),
  createRouteOption('/app/class-schedule', 'Schedule Live Classes', 'Admin scheduling for live classes.'),
  createRouteOption('/app/class-feedback', 'Class Feedback', 'Review live class feedback.'),
  createRouteOption('/app/attendance', 'Attendance', 'Overall attendance management.'),
  createRouteOption('/app/guidance-sessions', 'Mentorship Sessions', 'Admin mentorship session requests and control.'),
  createRouteOption('/app/leaves', 'Teacher Leaves', 'Teacher leave approvals and records.'),
  createRouteOption('/app/admin/logic-building-setup', 'Logic Building Setup', 'Contest setup and logic-building configuration.'),
  createRouteOption('/app/admin/logic-building-admin-scoreboard', 'Admin Scoreboard', 'Logic-building scoreboard and results admin view.'),
  createRouteOption('/app/admin/change-course', 'Change Course', 'Edit course-level admin content and assignments.'),
  createRouteOption('/app/admin/send-gift', 'Send Gift', 'Gift creation and manual gift actions.'),
  createRouteOption('/app/admin/active-coupons', 'Active Coupons', 'Coupon activation and coupon administration.'),
  createRouteOption('/app/admin/user-management', 'User Management', 'User records, locks, and profile administration.'),
  createRouteOption('/app/admin/certificate-blocks', 'Certificate Blocks', 'Block or restore certificate verification.'),
  createRouteOption('/app/admin/prize-certificates', 'Prizes & Certificates', 'Prize certificate creation and release.'),
  createRouteOption('/app/admin/user-ids', 'User IDs', 'User identity records and lookup tools.'),
  createRouteOption('/app/admin/teacher-progress', 'Teacher Progress', 'Teacher performance and progress tracking.'),
  createRouteOption('/app/admin/student-progress', 'Student Progress', 'Student performance and progress tracking.'),
  createRouteOption('/app/admin/manage-premium', 'Manage Premium', 'Premium grants, expiry changes, and membership edits.'),
  createRouteOption('/app/admin/teacher-assignment', 'Assign Teachers', 'Teacher assignment and reassignment controls.'),
  createRouteOption('/app/admin/student-reassignments', 'Student Reassignments', 'Student reassignment operations and approvals.'),
  createRouteOption('/app/admin/auto-assigned-students', 'Auto Assigned Students', 'Review auto-assigned student mappings.'),
  createRouteOption('/app/admin/teacher-requests', 'Teacher Requests', 'Incoming teacher/student assignment requests.'),
  createRouteOption('/app/admin/user-access', 'User Access', 'Direct access controls and per-user admin actions.'),
  createRouteOption('/app/admin/accounts', 'Account Management', 'Sensitive account updates and account state changes.'),
  createRouteOption('/app/admin/access-codes', 'Access Codes', 'Rotating access-code generation and management.'),
  createRouteOption('/app/admin/notifications', 'Post Notifications', 'Post admin notifications to users.'),
  createRouteOption('/app/admin/multi-session-alerts', 'Multi Session Alerts', 'Review multi-device or multi-session detections.'),
  createRouteOption('/app/admin/courses', 'Admin Courses', 'Admin course creation and course content updates.'),
  createRouteOption('/app/admin/exam-overrides', 'Exam Retake Overrides', 'Override exam eligibility and retake access.'),
  createRouteOption('/app/admin/choose-meet', 'Choose Meet', 'Select meeting provider settings.'),
  createRouteOption('/app/admin/allow-failed-to-book-slot', 'Allow Failed Slot Booking', 'Allow students to rebook failed live slots.'),
  createRouteOption('/app/admin/exam-retakes', 'Release Exams', 'Release terminated exams for another attempt.'),
  createRouteOption('/app/admin/exam-settings', 'Exam Settings', 'Admin-level exam configuration.'),
  createRouteOption('/app/admin/settings', 'Admin Settings', 'Global admin panel settings.'),
  createRouteOption('/app/admin/website-protection', 'Website Protection', 'Security and website protection settings.'),
  createRouteOption('/app/admin/support-contact', 'Support Contact', 'Support email and support contact configuration.'),
  createRouteOption('/app/admin/activity-logs', 'Activity Logs', 'Administrative activity log history.'),
  createRouteOption('/app/admin/lead-inbox', 'Lead Inbox', 'Lead and enquiry inbox management.'),
  createRouteOption('/app/admin/growth-analytics', 'Growth Analytics', 'Analytics and platform growth tracking.'),
  createRouteOption('/app/admin/issue-reports', 'Issue Reports', 'User issue reports and admin review queue.'),
  createRouteOption('/app/admin/reset-password', 'Reset Password', 'Admin-triggered password reset tools.'),
  createRouteOption('/app/admin/mfa-management', 'MFA Management', 'Admin MFA status and MFA admin controls.'),
  createRouteOption('/app/admin/mfa-rules', 'MFA Rules', 'Configure which admin pages require a fresh MFA check.'),
  createRouteOption('/app/admin/deleted-accounts', 'Deleted Accounts', 'Deleted-account review and recovery tools.'),
  createRouteOption('/app/admin/startup-ideas', 'Startup Ideas', 'Admin startup idea review and actions.'),
  createRouteOption('/app/admin/startup-collaborations', 'Startup Collaborations', 'Startup collaboration requests and admin actions.'),
  createRouteOption('/app/admin/users', 'Admin Users', 'Legacy admin user dashboard route.'),
  createRouteOption('/app/admin/leaves', 'Admin Leaves', 'Legacy admin leave dashboard route.'),
];

export const DEFAULT_ADMIN_SENSITIVE_MFA_PATHS = ADMIN_SENSITIVE_ROUTE_OPTIONS.map((item) => item.path);

export const normalizeAdminSensitivePaths = (rawValue) => {
  if (!rawValue) return [...DEFAULT_ADMIN_SENSITIVE_MFA_PATHS];

  try {
    const parsed = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
    if (!Array.isArray(parsed)) return [...DEFAULT_ADMIN_SENSITIVE_MFA_PATHS];

    const allowed = new Set(ADMIN_SENSITIVE_ROUTE_OPTIONS.map((item) => item.path));
    const normalized = parsed
      .map((item) => String(item || '').trim())
      .filter((item) => allowed.has(item));

    return Array.from(new Set(normalized));
  } catch {
    return [...DEFAULT_ADMIN_SENSITIVE_MFA_PATHS];
  }
};

export const isAdminPathProtectedBySensitiveMFA = (pathname, protectedPaths = DEFAULT_ADMIN_SENSITIVE_MFA_PATHS) => {
  const currentPath = String(pathname || '').trim();
  return protectedPaths.some((path) => currentPath === path || currentPath.startsWith(`${path}/`));
};
