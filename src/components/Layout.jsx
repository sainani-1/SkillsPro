import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';

const Layout = () => {
  const { profile } = useAuth();
  const { totalUnreadCount } = useChat();
  const navigate = useNavigate();
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
          <div />
          <div className="flex items-center space-x-6">
            {profile?.role === 'teacher' && (
              <div className="relative cursor-pointer" onClick={() => navigate('/app/teacher-chat')}>
                <Bell size={20} className="text-slate-600 hover:text-blue-600 transition" />
                {totalUnreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold animate-pulse">
                    {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center space-x-3">
                <div className="text-right">
                    <p className="text-sm font-bold text-nani-dark">{profile?.full_name}</p>
                    <p className="text-xs text-slate-500 capitalize">{profile?.role}</p>
                </div>
                <img 
                  src={profile?.avatar_url || "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80"} 
                  onError={(e) => { e.currentTarget.src = "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=200&q=80"; }}
                  alt="Profile" 
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