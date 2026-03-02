import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Bell, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import AvatarImage from './AvatarImage';

const Layout = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [panelSearch, setPanelSearch] = useState('');
  const [showPanelSearch, setShowPanelSearch] = useState(false);
  // Sidebar width: 16rem (w-64) when open, 5rem (w-20) when collapsed
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
      { label: 'Courses', path: '/app/courses' },
      { label: 'Profile', path: '/app/profile' },
      { label: 'Settings', path: '/app/settings' },
      { label: 'Notifications', path: '/app/notifications' },
      { label: 'Verify Certificate', path: '/app/verify' }
    ];
    if (role === 'admin') {
      return [
        ...common,
        { label: 'User Management', path: '/app/admin/user-management' },
        { label: 'Teacher Assignment', path: '/app/admin/teacher-assignment' },
        { label: 'Student Reassignments', path: '/app/admin/student-reassignments' },
        { label: 'MFA Management', path: '/app/admin/mfa-management' },
        { label: 'Prize Certificates', path: '/app/admin/prize-certificates' },
        { label: 'Certificate Blocks', path: '/app/admin/certificate-blocks' },
        { label: 'Exam Settings', path: '/app/admin/exam-settings' },
        { label: 'Manage Premium', path: '/app/admin/manage-premium' }
      ];
    }
    if (role === 'teacher') {
      return [
        ...common,
        { label: 'Clear Doubts', path: '/app/clear-doubts' },
        { label: 'My Students', path: '/app/my-students' },
        { label: 'Class Schedule', path: '/app/class-schedule' },
        { label: 'Leaves', path: '/app/leaves' },
        { label: 'Teacher Requests', path: '/app/teacher-requests' }
      ];
    }
    return [
      ...common,
      { label: 'My Certificates', path: '/app/my-certificates' },
      { label: 'Class Schedule', path: '/app/class-schedule' },
      { label: 'Attendance', path: '/app/attendance' },
      { label: 'Request Teacher', path: '/app/request-teacher' },
      { label: 'Premium Status', path: '/app/premium-status' }
    ];
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

    const fetchUnreadNotifications = async () => {
      try {
        const { data: notifications, error: notifError } = await supabase
          .from('admin_notifications')
          .select('id')
          .or(`target_role.eq.all,target_role.eq.${profile.role}`)
          .order('created_at', { ascending: false });

        if (notifError) throw notifError;
        if (!notifications || notifications.length === 0) {
          setUnreadNotifications(0);
          return;
        }

        const notificationIds = notifications.map((n) => n.id);
        const { data: reads, error: readError } = await supabase
          .from('notification_reads')
          .select('notification_id')
          .eq('user_id', profile.id)
          .in('notification_id', notificationIds);

        if (readError) throw readError;

        const readIds = new Set((reads || []).map((r) => r.notification_id));
        const unread = notifications.filter((n) => !readIds.has(n.id)).length;
        setUnreadNotifications(unread);
      } catch (error) {
        console.error('Layout: Error fetching unread notifications:', error);
        setUnreadNotifications(0);
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

export default Layout;
