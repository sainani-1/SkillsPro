import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Bell, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import AvatarImage from './AvatarImage';
import Toast from './Toast';
import { logAdminNavigation } from '../utils/adminActivityLogger';

const Layout = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [panelSearch, setPanelSearch] = useState('');
  const [showPanelSearch, setShowPanelSearch] = useState(false);
  // Sidebar width: 16rem (w-64) when open, 5rem (w-20) when collapsed
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notificationPollingEnabled, setNotificationPollingEnabled] = useState(true);
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const seenRealtimeNotificationIdsRef = useRef(new Set());
  const seenActivityEventKeysRef = useRef(new Set());

  const getLocalReadIds = (userId) => {
    if (!userId) return new Set();
    try {
      const raw = localStorage.getItem(`localNotificationReads_${userId}`);
      const ids = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(ids) ? ids : []);
    } catch {
      return new Set();
    }
  };

  const isFetchNetworkIssue = (err) => {
    const message = String(err?.message || '').toLowerCase();
    const details = String(err?.details || '').toLowerCase();
    return (
      message.includes('failed to fetch') ||
      message.includes('networkerror') ||
      details.includes('failed to fetch') ||
      details.includes('cors') ||
      message.includes('err_failed') ||
      message.includes('access to fetch')
    );
  };
  const isMissingTargetUserColumn = (err) => {
    const msg = String(err?.message || '').toLowerCase();
    const details = String(err?.details || '').toLowerCase();
    const hint = String(err?.hint || '').toLowerCase();
    return (
      msg.includes('target_user_id') ||
      details.includes('target_user_id') ||
      hint.includes('target_user_id')
    );
  };
  const extractLegacyTargetUserId = (text) => {
    const match = String(text || '').match(/\[target_user_id:([^\]]+)\]/i);
    return match?.[1] || null;
  };
  const isUuid = (value) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      String(value || '')
    );
  // Listen to sidebar width changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const sidebar = document.querySelector('aside');
      if (sidebar) {
        setSidebarCollapsed(sidebar.classList.contains('w-20'));
      }
    });

    const sidebar = document.querySelector('aside');
    if (sidebar) {
      observer.observe(sidebar, { attributes: true, attributeFilter: ['class'] });
    }

    return () => observer.disconnect();
  }, []);

  const getPanelTargets = (role) => {
    const common = [
      { label: 'Dashboard', path: '/app' },
      { label: 'Logic Building', path: '/app/logic-building-contest' },
      { label: 'Courses', path: '/app/courses' },
      { label: 'Verify Certificate', path: '/app/verify' },
      { label: 'Profile', path: '/app/profile' },
      { label: 'Mentorship Sessions', path: '/app/guidance-sessions' },
      { label: 'Notifications', path: '/app/notifications' },
      { label: 'Settings', path: '/app/settings' },
    ];

    const studentTargets = [
      ...common,
      { label: 'Write Test', path: '/app/write-test' },
      { label: 'My Certificates', path: '/app/my-certificates' },
      { label: 'Live Classes', path: '/app/class-schedule' },
      { label: 'Premium Membership', path: '/app/premium-status' },
      { label: 'Discounts & Offers', path: '/app/offers' },
      { label: 'Attendance', path: '/app/attendance' },
      { label: 'Ask a Doubt', path: '/app/chat' },
      { label: 'Request Teacher', path: '/app/request-teacher' },
      { label: 'Startup Ideas', path: '/app/startup-ideas' },
      { label: 'Startup Collaborations', path: '/app/startup-collaborations' },
    ];

    const teacherTargets = [
      ...common,
      { label: 'Conduct Tests', path: '/app/teacher/tests' },
      { label: 'Clear Doubts', path: '/app/clear-doubts' },
      { label: 'Attendance', path: '/app/attendance' },
      { label: 'My Students', path: '/app/my-students' },
      { label: 'Assigned Classes', path: '/app/assigned-classes' },
      { label: 'Schedule Sessions', path: '/app/class-schedule' },
      { label: 'Apply Leave', path: '/app/leaves' },
      { label: 'Session Reassignments', path: '/app/session-reassignments' },
      { label: 'Student Requests', path: '/app/teacher-requests' },
    ];

    const adminTargets = [
      ...common,
      { label: 'Admin Scoreboard', path: '/app/admin/logic-building-admin-scoreboard' },
      { label: 'Logic Building Setup', path: '/app/admin/logic-building-setup' },
      { label: 'Change Course', path: '/app/admin/change-course' },
      { label: 'Send Gift', path: '/app/admin/send-gift' },
      { label: 'Active Coupons', path: '/app/admin/active-coupons' },
      { label: 'User Management', path: '/app/admin/user-management' },
      { label: 'Certificate Blocks', path: '/app/admin/certificate-blocks' },
      { label: 'Prizes & Certificates', path: '/app/admin/prize-certificates' },
      { label: 'User IDs', path: '/app/admin/user-ids' },
      { label: 'Teacher Progress', path: '/app/admin/teacher-progress' },
      { label: 'Student Progress', path: '/app/admin/student-progress' },
      { label: 'Schedule Live Classes', path: '/app/class-schedule' },
      { label: 'Attendance', path: '/app/attendance' },
      { label: 'Manage Premium', path: '/app/admin/manage-premium' },
      { label: 'Assign Teachers', path: '/app/admin/teacher-assignment' },
      { label: 'Student Reassignments', path: '/app/admin/student-reassignments' },
      { label: 'Teacher Requests', path: '/app/admin/teacher-requests' },
      { label: 'Account Management', path: '/app/admin/accounts' },
      { label: 'Post Notifications', path: '/app/admin/notifications' },
      { label: 'Leave Requests', path: '/app/leaves' },
      { label: 'Admin Courses', path: '/app/admin/courses' },
      { label: 'Exam Retake Overrides', path: '/app/admin/exam-overrides' },
      { label: 'Manage Exam Retakes', path: '/app/admin/exam-retakes' },
      { label: 'Exam Settings', path: '/app/admin/exam-settings' },
      { label: 'Admin Settings', path: '/app/admin/settings' },
      { label: 'Reset Password', path: '/app/admin/reset-password' },
      { label: 'Activity Logs', path: '/app/admin/activity-logs' },
      { label: 'MFA Management', path: '/app/admin/mfa-management' },
      { label: 'Deleted Accounts', path: '/app/admin/deleted-accounts' },
      { label: 'Startup Ideas', path: '/app/admin/startup-ideas' },
      { label: 'Startup Collaborations', path: '/app/admin/startup-collaborations' },
    ];

    const targets = role === 'admin' ? adminTargets : role === 'teacher' ? teacherTargets : studentTargets;
    return targets.filter((item, index, arr) => arr.findIndex((x) => x.path === item.path) === index);
  };

  const panelTargets = getPanelTargets(profile?.role);
  const filteredTargets = !panelSearch.trim()
    ? []
    : panelTargets
        .filter((item) => item.label.toLowerCase().includes(panelSearch.trim().toLowerCase()))
        .slice(0, 8);

  useEffect(() => {
    if (!profile?.id || !profile?.role) {
      setUnreadNotifications(0);
      return;
    }
    if (!notificationPollingEnabled) return;

    const fetchUnreadNotifications = async () => {
      try {
        let roleScopedRes = await supabase
          .from('admin_notifications')
          .select('id, content, target_user_id, created_at')
          .or(`target_role.eq.all,target_role.eq.${profile.role},target_user_id.eq.${profile.id}`)
          .order('created_at', { ascending: false });

        if (roleScopedRes.error && isMissingTargetUserColumn(roleScopedRes.error)) {
          roleScopedRes = await supabase
            .from('admin_notifications')
            .select('id, content, created_at')
            .or(`target_role.eq.all,target_role.eq.${profile.role}`)
            .order('created_at', { ascending: false });
        }

        const notifications = roleScopedRes.data || [];
        const notifError = roleScopedRes.error;
        if (notifError) throw notifError;
        let visibleNotifications = (notifications || []).filter((n) => {
          const accountCreatedAt = profile?.created_at ? new Date(profile.created_at).getTime() : null;
          const notifCreatedAt = n?.created_at ? new Date(n.created_at).getTime() : null;
          if (
            accountCreatedAt &&
            notifCreatedAt &&
            Number.isFinite(accountCreatedAt) &&
            Number.isFinite(notifCreatedAt) &&
            notifCreatedAt < accountCreatedAt
          ) {
            return false;
          }
          if (n.target_user_id && String(n.target_user_id) !== String(profile.id)) return false;
          const legacyTarget = extractLegacyTargetUserId(n.content);
          return !legacyTarget || String(legacyTarget) === String(profile.id);
        });

        if (profile.role === 'student') {
          const { data: classRows, error: classErr } = await supabase
            .from('class_session_participants')
            .select('session_id')
            .eq('student_id', profile.id);
          if (!classErr && classRows?.length) {
            const synthetic = classRows.map((r) => ({ id: `class-session-${r.session_id}` }));
            const byId = new Map(visibleNotifications.map((n) => [n.id, n]));
            synthetic.forEach((n) => byId.set(n.id, n));
            visibleNotifications = Array.from(byId.values());
          }
        }

        if (!visibleNotifications.length) {
          setUnreadNotifications(0);
          return;
        }
        const notificationIds = visibleNotifications.map((n) => n.id);
        const dbNotificationIds = notificationIds.filter(isUuid);
        const readTrackingKey = `notificationReadsEnabled_${profile.id}`;
        const readTrackingEnabled =
          localStorage.getItem(readTrackingKey) !== 'false';
        const localReadIds = getLocalReadIds(profile.id);

        if (!readTrackingEnabled) {
          const unread = visibleNotifications.filter((n) => !localReadIds.has(n.id)).length;
          setUnreadNotifications(unread);
          return;
        }

        let reads = [];
        let readError = null;
        if (dbNotificationIds.length > 0) {
          const readRes = await supabase
            .from('notification_reads')
            .select('notification_id')
            .eq('user_id', profile.id)
            .in('notification_id', dbNotificationIds);
          reads = readRes.data || [];
          readError = readRes.error;
        }

        if (readError) {
          localStorage.setItem(readTrackingKey, 'false');
          const unread = visibleNotifications.filter((n) => !localReadIds.has(n.id)).length;
          setUnreadNotifications(unread);
          return;
        }

        const readIds = new Set([...(reads || []).map((r) => r.notification_id), ...localReadIds]);
        const unread = visibleNotifications.filter((n) => !readIds.has(n.id)).length;
        setUnreadNotifications(unread);
      } catch (error) {
        setUnreadNotifications(0);
        if (isFetchNetworkIssue(error)) {
          setNotificationPollingEnabled(false);
        }
      }
    };

    fetchUnreadNotifications();
    const interval = setInterval(fetchUnreadNotifications, 60000);
    const onFocus = () => fetchUnreadNotifications();
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [profile?.id, profile?.role, notificationPollingEnabled]);

  useEffect(() => {
    if (profile?.role !== 'admin' || !profile?.id) return;
    logAdminNavigation({
      adminId: profile.id,
      pathname: location.pathname,
      details: {
        source: 'layout',
      },
    });
  }, [profile?.id, profile?.role, location.pathname]);

  useEffect(() => {
    if (!profile?.id || !profile?.role) return;

    const pushActivityToast = (message) => {
      if (!message) return;
      setToast({ show: true, message, type: 'info' });
    };
    const markSeen = (key) => {
      if (!key) return false;
      if (seenActivityEventKeysRef.current.has(key)) return true;
      seenActivityEventKeysRef.current.add(key);
      return false;
    };

    const channel = supabase
      .channel(`layout-admin-notifications-${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_notifications' },
        (payload) => {
          const notif = payload?.new || {};
          const notifId = notif.id;
          if (!notifId || seenRealtimeNotificationIdsRef.current.has(notifId)) return;

          const targetRole = notif.target_role;
          const targetUserId = notif.target_user_id;
          const legacyTargetUserId = extractLegacyTargetUserId(notif.content);
          const roleMatch = targetRole === 'all' || targetRole === profile.role;
          const userMatch =
            (!targetUserId || targetUserId === profile.id) &&
            (!legacyTargetUserId || String(legacyTargetUserId) === String(profile.id));
          if (!roleMatch || !userMatch) return;

          seenRealtimeNotificationIdsRef.current.add(notifId);
          setUnreadNotifications((prev) => prev + 1);
          setToast({
            show: true,
            message: notif.title ? `New: ${notif.title}` : 'You have a new notification',
            type: 'info',
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'class_session_participants',
          filter: `student_id=eq.${profile.id}`,
        },
        (payload) => {
          const row = payload?.new || {};
          const eventKey = `class_session_participants:insert:${row.id || row.session_id}:${row.created_at || ''}`;
          if (markSeen(eventKey)) return;
          pushActivityToast('New class session added for you.');
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'class_sessions',
          filter: `teacher_id=eq.${profile.id}`,
        },
        (payload) => {
          if (profile.role !== 'teacher') return;
          const row = payload?.new || {};
          const eventKey = `class_sessions:insert:${row.id}:${row.created_at || ''}`;
          if (markSeen(eventKey)) return;
          pushActivityToast(`New class scheduled: ${row.title || 'Session'}`);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'teacher_assignment_requests' },
        (payload) => {
          const row = payload?.new || {};
          const eventKey = `teacher_assignment_requests:insert:${row.id}:${row.created_at || ''}`;
          if (markSeen(eventKey)) return;
          if (profile.role === 'admin') pushActivityToast('New teacher assignment request received.');
          if (profile.role === 'teacher' && row.teacher_id === profile.id) {
            pushActivityToast('New student request assigned to you.');
          }
          if (profile.role === 'student' && row.student_id === profile.id) {
            pushActivityToast('Your teacher request was submitted.');
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'teacher_assignment_requests' },
        (payload) => {
          const row = payload?.new || {};
          const eventKey = `teacher_assignment_requests:update:${row.id}:${row.updated_at || ''}`;
          if (markSeen(eventKey)) return;
          if (profile.role === 'student' && row.student_id === profile.id && row.status) {
            pushActivityToast(`Teacher request updated: ${String(row.status)}`);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leave_requests' },
        (payload) => {
          if (profile.role !== 'admin') return;
          const row = payload?.new || {};
          const eventKey = `leave_requests:insert:${row.id}:${row.created_at || ''}`;
          if (markSeen(eventKey)) return;
          pushActivityToast('New leave request submitted.');
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leave_requests' },
        (payload) => {
          if (profile.role !== 'teacher') return;
          const row = payload?.new || {};
          if (row.teacher_id !== profile.id) return;
          const eventKey = `leave_requests:update:${row.id}:${row.updated_at || ''}`;
          if (markSeen(eventKey)) return;
          if (row.status) pushActivityToast(`Leave status: ${String(row.status)}`);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'guidance_requests' },
        (payload) => {
          const row = payload?.new || {};
          const eventKey = `guidance_requests:insert:${row.id}:${row.created_at || ''}`;
          if (markSeen(eventKey)) return;
          if (profile.role === 'admin') pushActivityToast('New mentorship request received.');
          if (profile.role === 'student' && row.student_id === profile.id) {
            pushActivityToast('Your mentorship request was submitted.');
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'guidance_requests' },
        (payload) => {
          if (profile.role !== 'student') return;
          const row = payload?.new || {};
          if (row.student_id !== profile.id) return;
          const eventKey = `guidance_requests:update:${row.id}:${row.updated_at || ''}`;
          if (markSeen(eventKey)) return;
          if (row.status) pushActivityToast(`Mentorship request updated: ${String(row.status)}`);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'startup_ideas' },
        (payload) => {
          const row = payload?.new || {};
          const eventKey = `startup_ideas:insert:${row.id}:${row.created_at || ''}`;
          if (markSeen(eventKey)) return;
          if (profile.role === 'admin') pushActivityToast('New startup idea submitted.');
          if (profile.role === 'student' && row.user_id === profile.id) {
            pushActivityToast('Your startup idea was submitted.');
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'startup_ideas' },
        (payload) => {
          if (profile.role !== 'student') return;
          const row = payload?.new || {};
          if (row.user_id !== profile.id) return;
          const eventKey = `startup_ideas:update:${row.id}:${row.reviewed_at || row.updated_at || ''}`;
          if (markSeen(eventKey)) return;
          if (row.status && row.status !== 'pending') {
            pushActivityToast(`Startup idea status: ${String(row.status)}`);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'certificates', filter: `user_id=eq.${profile.id}` },
        (payload) => {
          if (profile.role !== 'student') return;
          const row = payload?.new || {};
          const eventKey = `certificates:insert:${row.id}:${row.issued_at || row.created_at || ''}`;
          if (markSeen(eventKey)) return;
          pushActivityToast('New certificate generated for you.');
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'certificates', filter: `user_id=eq.${profile.id}` },
        (payload) => {
          if (profile.role !== 'student') return;
          const row = payload?.new || {};
          const oldRow = payload?.old || {};
          const eventKey = `certificates:update:${row.id}:${row.revoked_at || row.updated_at || ''}`;
          if (markSeen(eventKey)) return;
          if (!oldRow.revoked_at && row.revoked_at) {
            pushActivityToast('A certificate was blocked.');
          } else if (oldRow.revoked_at && !row.revoked_at) {
            pushActivityToast('A certificate was unblocked.');
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'generated_certificates', filter: `user_id=eq.${profile.id}` },
        (payload) => {
          if (profile.role !== 'student') return;
          const row = payload?.new || {};
          const eventKey = `generated_certificates:insert:${row.id}:${row.issued_at || row.created_at || ''}`;
          if (markSeen(eventKey)) return;
          pushActivityToast('New prize certificate added.');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, profile?.role]);

  // Sidebar width: 16rem (256px) when open, 5rem (80px) when collapsed
  // We'll use a state to track the sidebar width for margin
  const [sidebarWidth, setSidebarWidth] = useState(256); // default w-64

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const sidebar = document.querySelector('aside');
      if (sidebar) {
        if (sidebar.classList.contains('w-20')) {
          setSidebarWidth(80);
        } else {
          setSidebarWidth(256);
        }
      }
    });
    const sidebar = document.querySelector('aside');
    if (sidebar) {
      observer.observe(sidebar, { attributes: true, attributeFilter: ['class'] });
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div className="bg-slate-50 min-h-screen">
      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />
      <Sidebar />
      <div
        className="flex flex-col transition-all duration-300"
        style={{ marginLeft: sidebarWidth, minHeight: '100vh' }}
      >
        {/* Top Navbar */}
        <header className="bg-white shadow-sm h-16 flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="relative w-full max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={panelSearch}
              onFocus={() => setShowPanelSearch(true)}
              onBlur={() => setTimeout(() => setShowPanelSearch(false), 120)}
              onChange={(e) => setPanelSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filteredTargets.length > 0) {
                  navigate(filteredTargets[0].path);
                  setPanelSearch('');
                }
              }}
              placeholder="Search panel pages..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {showPanelSearch && filteredTargets.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg overflow-hidden z-40">
                {filteredTargets.map((item) => (
                  <button
                    key={item.path}
                    type="button"
                    onMouseDown={() => {
                      navigate(item.path);
                      setPanelSearch('');
                      setShowPanelSearch(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm border-b last:border-b-0"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-6">
            <div className="relative cursor-pointer" onClick={() => navigate('/app/notifications')}>
              <Bell size={20} className="text-slate-600 hover:text-blue-600 transition" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold animate-pulse">
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-3">
                <div className="text-right">
                    <p className="text-sm font-bold text-nani-dark">{profile?.full_name}</p>
                    <p className="text-xs text-slate-500 capitalize">{profile?.role}</p>
                </div>
                <AvatarImage
                  userId={profile?.id}
                  avatarUrl={profile?.avatar_url}
                  alt="Profile"
                  fallbackName={profile?.full_name || 'User'}
                  className="w-10 h-10 rounded-full border-2 border-gold-400 object-cover"
                />
            </div>
          </div>
        </header>
        {/* Main Content */}
        <main className="p-8 flex-1 overflow-y-auto" style={{ height: 'calc(100vh - 64px - 48px)', maxHeight: 'calc(100vh - 64px - 48px)' }}>
          <Outlet />
        </main>
        {/* Footer */}
        <footer className="text-center py-4 text-xs text-slate-400">
           &copy; {new Date().getFullYear()} SkillPro. All rights reserved. 
        </footer>
      </div>
    </div>
  );
};

export { Layout };
export default Layout;

