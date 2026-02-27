import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, BookOpen, User, GraduationCap, Video, Users, CheckSquare, LogOut, FileBadge, ShieldCheck, ClipboardList, Sparkles, MessageCircle, Calendar, Award, UserPlus, Lock, Unlock, Bell, Clock, Briefcase, ChevronLeft, ChevronRight, Settings, Gift } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';

const Sidebar = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const role = profile?.role || 'student';
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadChats, setUnreadChats] = useState(0);
  const [newUserRegistrations, setNewUserRegistrations] = useState(0);
  const [newTeacherRequests, setNewTeacherRequests] = useState(0);
  const [newLeaveRequests, setNewLeaveRequests] = useState(0);
  const [newGuidanceRequests, setNewGuidanceRequests] = useState(0);
  // Fetch new guidance session requests (Admin only)
  useEffect(() => {
    if (!profile?.id || role !== 'admin') return;

    const fetchNewGuidanceRequests = async () => {
      try {
        const lastSeenKey = `lastSeenGuidanceRequests_${profile.id}`;
        const lastSeen = localStorage.getItem(lastSeenKey);
        // If on guidance sessions page, update last seen
        if (location.pathname === '/app/guidance-sessions') {
          localStorage.setItem(lastSeenKey, new Date().toISOString());
          setNewGuidanceRequests(0);
          return;
        }
        const { data, error } = await supabase
          .from('guidance_requests')
          .select('id, created_at, status')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (lastSeen && data) {
          const newCount = data.filter(r => new Date(r.created_at) > new Date(lastSeen)).length;
          setNewGuidanceRequests(newCount);
        } else {
          setNewGuidanceRequests(data?.length || 0);
        }
      } catch (err) {
        console.error('Error fetching new guidance requests:', err);
      }
    };
    fetchNewGuidanceRequests();
    const interval = setInterval(fetchNewGuidanceRequests, 30000);
    return () => clearInterval(interval);
  }, [profile?.id, role, location.pathname]);

  const navItemClass = ({ isActive }) =>
    `flex items-center ${isCollapsed && !isHovered ? 'justify-center' : 'space-x-3'} px-4 py-4 rounded-lg transition-all duration-600 whitespace-nowrap ${isActive ? 'bg-gold-400 text-nani-dark font-bold' : 'text-slate-300 hover:bg-white/10'}`;

  const shouldShowText = !isCollapsed || isHovered;

  // Fetch unread notifications count
  useEffect(() => {
    if (!profile?.id) return;

    const fetchUnreadNotifications = async () => {
      try {
        // Get all notifications for the user's role
        const { data: notifications, error: notifError } = await supabase
          .from('admin_notifications')
          .select('id')
          .or(`target_role.eq.all,target_role.eq.${role}`)
          .order('created_at', { ascending: false });

        if (notifError) throw notifError;

        if (!notifications || notifications.length === 0) {
          setUnreadNotifications(0);
          return;
        }

        const notificationIds = notifications.map(n => n.id);

        // Get read notifications
        const { data: readNotifs, error: readError } = await supabase
          .from('notification_reads')
          .select('notification_id')
          .eq('user_id', profile.id)
          .in('notification_id', notificationIds);

        if (readError) throw readError;

        const readIds = new Set(readNotifs?.map(r => r.notification_id) || []);
        const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;
        setUnreadNotifications(unreadCount);
      } catch (err) {
        console.error('Error fetching unread notifications:', err);
      }
    };

    fetchUnreadNotifications();
    const interval = setInterval(fetchUnreadNotifications, 60000); // Check every minute
    const onFocus = () => fetchUnreadNotifications();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchUnreadNotifications();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [profile?.id, role, location.pathname]);

  // Fetch unread chats count
  useEffect(() => {
    if (!profile?.id) return;

    const fetchUnreadChats = async () => {
      try {
        // Get all chat groups where user is a member
        const { data: memberGroups, error: memberError } = await supabase
          .from('chat_members')
          .select('group_id')
          .eq('user_id', profile.id);

        if (memberError) throw memberError;

        if (!memberGroups || memberGroups.length === 0) {
          setUnreadChats(0);
          return;
        }

        const groupIds = memberGroups.map(m => m.group_id);

        // Load chatReadTimes from localStorage
        const stored = localStorage.getItem(`chatReadTimes_${profile.id}`);
        let chatReadTimes = new Map();
        if (stored) {
          try {
            chatReadTimes = new Map(JSON.parse(stored));
          } catch (e) {
            console.error('Error loading read times:', e);
          }
        }

        // If user is on the chat page, mark all chats as read immediately
        if (location.pathname.startsWith('/app/chat')) {
          const now = new Date().toISOString();
          groupIds.forEach(id => chatReadTimes.set(id, now));
          localStorage.setItem(`chatReadTimes_${profile.id}`, JSON.stringify(Array.from(chatReadTimes.entries())));
          setUnreadChats(0);
          return;
        }

        // Check each group for unread messages
        let totalUnread = 0;
        for (const groupId of groupIds) {
          const { data: messages } = await supabase
            .from('chat_messages')
            .select('id, sender_id, created_at')
            .eq('group_id', groupId)
            .order('created_at', { ascending: false });

          // If there are no messages at all, don't flag unread
          if (!messages || messages.length === 0) continue;

          const lastReadAt = chatReadTimes.get(groupId);
          let unreadCount = 0;

          if (lastReadAt) {
            unreadCount = messages.filter(
              m => m.sender_id !== profile.id && new Date(m.created_at) > new Date(lastReadAt)
            ).length;
          } else {
            // If never read, count only messages from others
            unreadCount = messages.filter(m => m.sender_id !== profile.id).length;
          }

          if (unreadCount > 0) totalUnread++;
        }

        setUnreadChats(totalUnread);
      } catch (err) {
        console.error('Error fetching unread chats:', err);
      }
    };

    fetchUnreadChats();
    const interval = setInterval(fetchUnreadChats, 60000); // Check every minute
    const onFocus = () => fetchUnreadChats();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchUnreadChats();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [profile?.id, location.pathname]);

  // Fetch new user registrations count (Admin only)
  useEffect(() => {
    if (!profile?.id || role !== 'admin') return;

    const fetchNewUsers = async () => {
      try {
        const lastSeenKey = `lastSeenUsers_${profile.id}`;
        const lastSeen = localStorage.getItem(lastSeenKey);

        // If on user management page, update last seen
        if (location.pathname === '/app/admin/user-management') {
          localStorage.setItem(lastSeenKey, new Date().toISOString());
          setNewUserRegistrations(0);
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('id, created_at')
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (lastSeen && data) {
          const newCount = data.filter(u => new Date(u.created_at) > new Date(lastSeen)).length;
          setNewUserRegistrations(newCount);
        }
      } catch (err) {
        console.error('Error fetching new users:', err);
      }
    };

    fetchNewUsers();
    const interval = setInterval(fetchNewUsers, 30000);
    return () => clearInterval(interval);
  }, [profile?.id, role, location.pathname]);

  // Fetch new teacher assignment requests (Admin and Teacher)
  useEffect(() => {
    if (!profile?.id || (role !== 'admin' && role !== 'teacher')) return;

    const fetchNewRequests = async () => {
      try {
        const lastSeenKey = `lastSeenTeacherRequests_${profile.id}`;
        const lastSeen = localStorage.getItem(lastSeenKey);

        // If on requests page, update last seen
        if (location.pathname === '/app/admin/teacher-requests' || location.pathname === '/app/teacher-requests') {
          localStorage.setItem(lastSeenKey, new Date().toISOString());
          setNewTeacherRequests(0);
          return;
        }

        let query = supabase
          .from('teacher_assignment_requests')
          .select('id, created_at, status')
          .eq('status', 'pending');

        // Teachers only see their own requests
        if (role === 'teacher') {
          query = query.eq('teacher_id', profile.id);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;

        if (lastSeen && data) {
          const newCount = data.filter(r => new Date(r.created_at) > new Date(lastSeen)).length;
          setNewTeacherRequests(newCount);
        } else {
          setNewTeacherRequests(data?.length || 0);
        }
      } catch (err) {
        console.error('Error fetching new teacher requests:', err);
      }
    };

    fetchNewRequests();
    const interval = setInterval(fetchNewRequests, 30000);
    return () => clearInterval(interval);
  }, [profile?.id, role, location.pathname]);

  // Fetch new leave requests (Admin only)
  useEffect(() => {
    if (!profile?.id || role !== 'admin') return;

    const fetchNewLeaves = async () => {
      try {
        const lastSeenKey = `lastSeenLeaves_${profile.id}`;
        const lastSeen = localStorage.getItem(lastSeenKey);

        // If on leaves page, update last seen
        if (location.pathname === '/app/leaves') {
          localStorage.setItem(lastSeenKey, new Date().toISOString());
          setNewLeaveRequests(0);
          return;
        }

        const { data, error } = await supabase
          .from('leave_requests')
          .select('id, created_at, status')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (lastSeen && data) {
          const newCount = data.filter(l => new Date(l.created_at) > new Date(lastSeen)).length;
          setNewLeaveRequests(newCount);
        } else {
          setNewLeaveRequests(data?.length || 0);
        }
      } catch (err) {
        console.error('Error fetching new leave requests:', err);
      }
    };

    fetchNewLeaves();
    const interval = setInterval(fetchNewLeaves, 30000);
    return () => clearInterval(interval);
  }, [profile?.id, role, location.pathname]);

  return (
    <aside
      className={`${isCollapsed && !isHovered ? 'w-20' : 'w-64'} bg-nani-dark text-white h-screen flex flex-col fixed left-0 top-0 transition-all duration-600 z-30`}
      style={{ minHeight: '100vh' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="p-6 border-b border-white/10 flex-shrink-0">
        <div
          className={`flex items-center ${isCollapsed && !isHovered ? 'justify-center' : 'space-x-2'} cursor-pointer hover:opacity-80 transition-opacity`}
          onClick={() => navigate('/app')}
        >
          <div className="w-10 h-10 rounded-full bg-gold-400 flex items-center justify-center text-nani-dark font-serif font-bold text-xl">
            SP
          </div>
          {shouldShowText && <span className="font-bold text-xl tracking-tight">SkillPro</span>}
        </div>
        {shouldShowText && <p className="text-xs text-slate-400 mt-2 uppercase tracking-wider">{role} Panel</p>}
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute top-20 -right-4 bg-gold-400 text-nani-dark rounded-full p-2 shadow-lg hover:bg-gold-300 transition-colors z-20"
        title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
      >
        {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
      </button>

      <nav className="flex-1 p-4 space-y-3 overflow-y-auto scrollbar-thin scrollbar-thumb-gold-400 scrollbar-track-nani-dark/50 flex flex-col">
        <NavLink to="/app" end className={navItemClass} title="Dashboard">
          <LayoutDashboard size={28} />
          {shouldShowText && <span>Dashboard</span>}
        </NavLink>
        <NavLink to="/app/logic-building-contest" className={navItemClass} title="Logic Building Contest">
          <Sparkles size={28} />
          {shouldShowText && <span>Logic Building</span>}
        </NavLink>
        {role === 'admin' && (
          <NavLink to="/app/admin/logic-building-admin-scoreboard" className={navItemClass} title="Logic Building Admin Scoreboard">
            <Award size={28} />
            {shouldShowText && <span>Admin Scoreboard</span>}
          </NavLink>
        )}

        <NavLink to="/app/courses" className={navItemClass} title="Courses">
          <BookOpen size={28} />
          {shouldShowText && <span>Courses</span>}
        </NavLink>

        <NavLink to="/app/verify" className={navItemClass} title="Verify Certificate">
          <ShieldCheck size={28} />
          {shouldShowText && <span>Verify Certificate</span>}
        </NavLink>

        <NavLink to="/app/profile" className={navItemClass} title="Profile">
          <User size={28} />
          {shouldShowText && <span>Profile</span>}
        </NavLink>

        <NavLink to="/app/guidance" className={navItemClass} title="Career Mentorship">
          <Video size={28} />
          {shouldShowText && <span>Career Mentorship</span>}
        </NavLink>

        <NavLink to="/app/guidance-sessions" className={navItemClass} title="Mentorship Sessions">
          <Calendar size={28} />
          {shouldShowText && <span>Mentorship Sessions</span>}
          {role === 'admin' && newGuidanceRequests > 0 && (
            <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {newGuidanceRequests > 9 ? '9+' : newGuidanceRequests}
            </span>
          )}
        </NavLink>

        <NavLink to="/app/notifications" className={navItemClass} title="Notifications">
          <Bell size={28} />
          {shouldShowText && <span>Notifications</span>}
          {unreadNotifications > 0 && (
            <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {unreadNotifications > 9 ? '9+' : unreadNotifications}
            </span>
          )}
        </NavLink>

        {/* Student Specific */}
        {role === 'student' && (
          <>
            <NavLink to="/app/learning-path" className={navItemClass} title="AI Learning Path">
              <Sparkles size={28} />
              {shouldShowText && <span>AI Learning Path</span>}
            </NavLink>
            <NavLink to="/app/my-certificates" className={navItemClass} title="My Certificates">
              <GraduationCap size={28} />
              {shouldShowText && <span>My Certificates</span>}
            </NavLink>
            <NavLink to="/app/class-schedule" className={navItemClass} title="Live Classes">
              <Video size={28} />
              {shouldShowText && <span>Live Classes</span>}
            </NavLink>
            <NavLink to="/app/premium-status" className={navItemClass} title="Premium Membership">
              <Award size={28} />
              {shouldShowText && <span>Premium Membership</span>}
            </NavLink>
            <NavLink to="/app/offers" className={navItemClass} title="Discounts & Offers">
              <Gift size={28} />
              {shouldShowText && <span>Discounts & Offers</span>}
            </NavLink>
            <NavLink to="/app/career-chatbot" className={navItemClass} title="Career AI Chat">
              <MessageCircle size={28} />
              {shouldShowText && <span>Career AI Chat</span>}
            </NavLink>
            <NavLink to="/app/attendance" className={navItemClass} title="Attendance">
              <ClipboardList size={28} />
              {shouldShowText && <span>Attendance</span>}
            </NavLink>
            <NavLink to="/app/chat" className={navItemClass} title="Ask a Doubt">
              <MessageCircle size={28} />
              {shouldShowText && <span>Ask a Doubt</span>}
              {unreadChats > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadChats > 9 ? '9+' : unreadChats}
                </span>
              )}
            </NavLink>
            <NavLink to="/app/request-teacher" className={navItemClass} title="Request Teacher">
              <UserPlus size={28} />
              {shouldShowText && <span>Request Teacher</span>}
            </NavLink>
          </>
        )}

        {/* Teacher Specific */}
        {role === 'teacher' && (
          <>
            <NavLink to="/app/clear-doubts" className={navItemClass} title="Clear Doubts">
              <MessageCircle size={28} />
              {shouldShowText && <span>Clear Doubts</span>}
              {unreadChats > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadChats > 9 ? '9+' : unreadChats}
                </span>
              )}
            </NavLink>
            <NavLink to="/app/attendance" className={navItemClass} title="Attendance">
              <CheckSquare size={28} />
              {shouldShowText && <span>Attendance</span>}
            </NavLink>
            <NavLink to="/app/my-students" className={navItemClass} title="My Students">
              <Users size={28} />
              {shouldShowText && <span>My Students</span>}
            </NavLink>
            <NavLink to="/app/assigned-classes" className={navItemClass} title="Assigned Classes">
              <Video size={28} />
              {shouldShowText && <span>Assigned Classes</span>}
            </NavLink>
            <NavLink to="/app/class-schedule" className={navItemClass} title="Schedule Sessions">
              <Calendar size={28} />
              {shouldShowText && <span>Schedule Sessions</span>}
            </NavLink>
            <NavLink to="/app/leaves" className={navItemClass} title="Apply Leave">
              <Calendar size={28} />
              {shouldShowText && <span>Apply Leave</span>}
            </NavLink>
            <NavLink to="/app/session-reassignments" className={navItemClass} title="Session Reassignments">
              <Users size={28} />
              {shouldShowText && <span>Session Reassignments</span>}
            </NavLink>
            <NavLink to="/app/teacher-requests" className={navItemClass} title="Student Requests">
              <UserPlus size={28} />
              {shouldShowText && <span>Student Requests</span>}
              {newTeacherRequests > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {newTeacherRequests > 9 ? '9+' : newTeacherRequests}
                </span>
              )}
            </NavLink>
          </>
        )}

        {/* Admin Specific */}
        {role === 'admin' && (
          <>
            <NavLink to="/app/admin/logic-building-setup" className={navItemClass} title="Logic Building Setup">
              <Sparkles size={28} />
              {shouldShowText && <span>Logic Building Setup</span>}
            </NavLink>
            <NavLink to="/app/admin/change-course" className={navItemClass} title="Change Course">
              <BookOpen size={28} />
              {shouldShowText && <span>Change Course</span>}
            </NavLink>
            {role === 'admin' && (
              <>
                <NavLink to="/app/admin/send-gift" className={navItemClass} title="Send Gift">
                  <Gift size={28} />
                  {shouldShowText && <span>Send Gift</span>}
                </NavLink>
                <NavLink to="/app/admin/active-coupons" className={navItemClass} title="Active Coupons">
                  <Gift size={28} />
                  {shouldShowText && <span>Active Coupons</span>}
                </NavLink>
              </>
            )}
            <NavLink to="/app/admin/user-management" className={navItemClass} title="User Management">
              <Users size={28} />
              {shouldShowText && <span>User Management</span>}
              {newUserRegistrations > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {newUserRegistrations > 9 ? '9+' : newUserRegistrations}
                </span>
              )}
            </NavLink>
            <NavLink to="/app/admin/certificate-blocks" className={navItemClass} title="Certificate Blocks">
              <Award size={28} />
              {shouldShowText && <span>Certificate Blocks</span>}
            </NavLink>
            <NavLink to="/app/admin/user-ids" className={navItemClass} title="User IDs">
              <User size={28} />
              {shouldShowText && <span>User IDs</span>}
            </NavLink>
            <NavLink to="/app/admin/teacher-progress" className={navItemClass} title="Teacher Progress">
              <Sparkles size={28} />
              {shouldShowText && <span>Teacher Progress</span>}
            </NavLink>
            <NavLink to="/app/admin/student-progress" className={navItemClass} title="Student Progress">
              <GraduationCap size={28} />
              {shouldShowText && <span>Student Progress</span>}
            </NavLink>
            <NavLink to="/app/class-schedule" className={navItemClass} title="Schedule Live Classes">
              <Video size={28} />
              {shouldShowText && <span>Schedule Live Classes</span>}
            </NavLink>
            <NavLink to="/app/attendance" className={navItemClass} title="Attendance">
              <CheckSquare size={28} />
              {shouldShowText && <span>Attendance</span>}
            </NavLink>
            <NavLink to="/app/admin/manage-premium" className={navItemClass} title="Manage Premium">
              <Award size={28} />
              {shouldShowText && <span>Manage Premium</span>}
            </NavLink>
            <NavLink to="/app/admin/teacher-assignment" className={navItemClass} title="Assign Teachers">
              <UserPlus size={28} />
              {shouldShowText && <span>Assign Teachers</span>}
            </NavLink>
            <NavLink to="/app/admin/teacher-requests" className={navItemClass} title="Teacher Requests">
              <Users size={28} />
              {shouldShowText && <span>Teacher Requests</span>}
              {newTeacherRequests > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {newTeacherRequests > 9 ? '9+' : newTeacherRequests}
                </span>
              )}
            </NavLink>
            <NavLink to="/app/admin/accounts" className={navItemClass} title="Account Management">
              <Lock size={28} />
              {shouldShowText && <span>Account Management</span>}
            </NavLink>
            <NavLink to="/app/admin/notifications" className={navItemClass} title="Post Notifications">
              <Bell size={28} />
              {shouldShowText && <span>Post Notifications</span>}
            </NavLink>
            <NavLink to="/app/leaves" className={navItemClass} title="Leave Requests">
              <Calendar size={28} />
              {shouldShowText && <span>Leave Requests</span>}
              {newLeaveRequests > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {newLeaveRequests > 9 ? '9+' : newLeaveRequests}
                </span>
              )}
            </NavLink>
            <NavLink to="/app/admin/courses" className={navItemClass} title="Courses">
              <BookOpen size={28} />
              {shouldShowText && <span>Courses</span>}
            </NavLink>
            <NavLink to="/app/admin/exam-overrides" className={navItemClass} title="Exam Retake Overrides">
              <Clock size={28} />
              {shouldShowText && <span>Exam Retake Overrides</span>}
            </NavLink>
            <NavLink to="/app/admin/exam-retakes" className={navItemClass} title="Manage Exam Retakes">
              <Unlock size={28} />
              {shouldShowText && <span>Manage Exam Retakes</span>}
            </NavLink>
            <NavLink to="/app/admin/exam-settings" className={navItemClass} title="Exam Settings">
              <CheckSquare size={28} />
              {shouldShowText && <span>Exam Settings</span>}
            </NavLink>
            <NavLink to="/app/admin/settings" className={navItemClass} title="Platform Settings">
              <Settings size={28} />
              {shouldShowText && <span>Platform Settings</span>}
            </NavLink>
            {/* Send Gift - Admin only (single entry) */}
          </>
        )}

        {/* Settings - Available for all roles */}
        <NavLink to="/app/settings" className={navItemClass} title="Settings">
          <Settings size={28} />
          {shouldShowText && <span>Settings</span>}
        </NavLink>

        <div className="pt-8 mt-8 border-t border-white/10 flex-shrink-0">
          <button onClick={signOut} className={`flex items-center ${isCollapsed && !isHovered ? 'justify-center' : 'space-x-3'} px-4 py-3 text-red-400 hover:text-red-300 w-full rounded-lg transition-all duration-600 whitespace-nowrap`} title="Sign Out">
            <LogOut size={28} />
            {shouldShowText && <span>Sign Out</span>}
          </button>
        </div>
      </nav>
    </aside>
  );
};

export default Sidebar;
