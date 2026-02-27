import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Bell, CheckCircle } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  const fetchUser = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user?.id) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('id', sessionData.session.user.id)
          .single();

        setUser(profileData);
      }
    } catch (err) {
      console.error('Error fetching user:', err);
    }
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError('');

      if (!user?.id) {
        setError('Not authenticated');
        return;
      }

      // Fetch notifications based on user role
      const { data, error: fetchError } = await supabase
        .from('admin_notifications')
        .select('id, title, content, type, target_role, created_at')
        .or(`target_role.eq.all,target_role.eq.${user.role}`)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const notificationIds = (data || []).map((n) => n.id);

      // Fetch read receipts for this user only
      let readIds = new Set();
      if (notificationIds.length > 0) {
        const { data: reads, error: readError } = await supabase
          .from('notification_reads')
          .select('notification_id')
          .eq('user_id', user.id)
          .in('notification_id', notificationIds);

        if (readError) throw readError;
        readIds = new Set(reads?.map((r) => r.notification_id) || []);
      }

      const unreadIds = notificationIds.filter((id) => !readIds.has(id));

      // Auto-mark all as read when the page is opened
      if (unreadIds.length > 0) {
        const rows = unreadIds.map((id) => ({ notification_id: id, user_id: user.id }));
        const { error: upsertError } = await supabase
          .from('notification_reads')
          .upsert(rows, { onConflict: 'notification_id,user_id' });
        if (upsertError) throw upsertError;
        unreadIds.forEach((id) => readIds.add(id));
      }

      const formattedData = (data || []).map((notif) => ({
        ...notif,
        isRead: readIds.has(notif.id),
      }));

      setNotifications(formattedData);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      if (!user?.id) return;

      // Check if already marked as read
      const { data: existingRead } = await supabase
        .from('notification_reads')
        .select('id')
        .eq('notification_id', notificationId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!existingRead) {
        const { error: insertError } = await supabase
          .from('notification_reads')
          .insert({
            notification_id: notificationId,
            user_id: user.id,
          });

        if (insertError) throw insertError;
      }

      // Update local state
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notificationId ? { ...notif, isRead: true } : notif
        )
      );
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-900';
      case 'success':
        return 'bg-green-50 border-green-200 text-green-900';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-900';
    }
  };

  const getTypeBadgeColor = (type) => {
    switch (type) {
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'success':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <Bell className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600">Loading notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Bell className="w-8 h-8 text-amber-500" />
            <h1 className="text-4xl font-bold text-slate-900">Notifications</h1>
          </div>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium">
              {unreadCount} new
            </span>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-700">
            {error}
          </div>
        )}

        {/* Notifications List */}
        {loading ? (
          <LoadingSpinner message="Loading notifications..." />
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => !notif.isRead && markAsRead(notif.id)}
                className={`border rounded-lg p-6 cursor-pointer transition-all ${getTypeColor(notif.type)} ${
                  !notif.isRead ? 'shadow-md' : 'shadow'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`px-3 py-1 text-xs font-medium rounded-full ${getTypeBadgeColor(
                          notif.type
                        )}`}
                      >
                        {notif.type.toUpperCase()}
                      </span>
                      {!notif.isRead && (
                        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{notif.title}</h3>
                    <p className="text-sm opacity-90 mb-3">{notif.content}</p>
                    <p className="text-xs opacity-70">
                      {new Date(notif.created_at).toLocaleDateString()} at{' '}
                      {new Date(notif.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                  {notif.isRead && (
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-1" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
