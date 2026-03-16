import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Bell, CheckCircle, X } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  getLocalNotificationReadIds,
  NOTIFICATION_READS_UPDATED_EVENT,
  saveLocalNotificationReadIds
} from '../utils/notificationReadState';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [networkBlocked, setNetworkBlocked] = useState(false);

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
  const extractLegacyTargetUserId = (text) => {
    const match = String(text || '').match(/\[target_user_id:([^\]]+)\]/i);
    return match?.[1] || null;
  };
  const stripLegacyTargetMarker = (text) =>
    String(text || '').replace(/^\s*\[target_user_id:[^\]]+\]\s*/i, '');
  const isUuid = (value) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      String(value || '')
    );
  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  useEffect(() => {
    if (!user?.id) return;
    const interval = setInterval(() => {
      fetchNotifications();
    }, 60000);
    const onFocus = () => fetchNotifications();
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchNotifications();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(NOTIFICATION_READS_UPDATED_EVENT, onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(NOTIFICATION_READS_UPDATED_EVENT, onFocus);
    };
  }, [user?.id]);

  const fetchUser = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user?.id) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, role, created_at')
          .eq('id', sessionData.session.user.id)
          .single();

        setUser(profileData);
      }
    } catch (err) {
      setUser(null);
    }
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError('');
      if (networkBlocked) {
        setNotifications([]);
        return;
      }

      if (!user?.id) {
        setError('Not authenticated');
        return;
      }

      // Fetch notifications using role scope only (schema-safe across deployments).
      const roleScopedRes = await supabase
        .from('admin_notifications')
        .select('id, title, content, type, target_role, target_user_id, created_at')
        .or(`target_role.eq.all,target_role.eq.${user.role}`)
        .order('created_at', { ascending: false });

      const data = roleScopedRes.data || [];
      if (roleScopedRes.error) throw roleScopedRes.error;
      const visibleData = (data || [])
        .filter((notif) => {
          const accountCreatedAt = user?.created_at ? new Date(user.created_at).getTime() : null;
          const notifCreatedAt = notif?.created_at ? new Date(notif.created_at).getTime() : null;
          if (
            accountCreatedAt &&
            notifCreatedAt &&
            Number.isFinite(accountCreatedAt) &&
            Number.isFinite(notifCreatedAt) &&
            notifCreatedAt < accountCreatedAt
          ) {
            return false;
          }
          const legacyTarget = extractLegacyTargetUserId(notif.content);
          const explicitTarget = notif?.target_user_id;
          const explicitMatch = !explicitTarget || String(explicitTarget) === String(user.id);
          const legacyMatch = !legacyTarget || String(legacyTarget) === String(user.id);
          return explicitMatch && legacyMatch;
        })
        .map((notif) => ({
          ...notif,
          content: stripLegacyTargetMarker(notif.content),
        }));

      // Fallback source: class session assignments (for environments where teacher cannot insert admin_notifications).
      let classSessionNotifs = [];
      if (user.role === 'student') {
        const { data: classRows } = await supabase
          .from('class_session_participants')
          .select('session_id, created_at, class_sessions(title, scheduled_for, ends_at)')
          .eq('student_id', user.id)
          .order('created_at', { ascending: false });

        classSessionNotifs = (classRows || []).map((row) => {
          const session = row.class_sessions || {};
          const startAt = session.scheduled_for ? new Date(session.scheduled_for) : null;
          const endAt = session.ends_at ? new Date(session.ends_at) : null;
          const startText = startAt
            ? startAt.toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              })
            : 'scheduled time';
          const endText = endAt
            ? endAt.toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              })
            : null;

          return {
            id: `class-session-${row.session_id}`,
            title: `Class Scheduled: ${session.title || 'Live Session'}`,
            content: endText
              ? `You have a class scheduled for ${startText} (upto ${endText}).`
              : `You have a class scheduled for ${startText}.`,
            type: 'info',
            target_role: 'student',
            created_at: row.created_at || session.scheduled_for || new Date().toISOString(),
            isSynthetic: true,
          };
        });
      }

      const mergedNotifs = [...visibleData, ...classSessionNotifs];
      const byId = new Map(mergedNotifs.map((n) => [n.id, n]));
      const finalNotifs = Array.from(byId.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      const notificationIds = finalNotifs.map((n) => n.id);
      const dbNotificationIds = notificationIds.filter(isUuid);
      const readTrackingKey = `notificationReadsEnabled_${user.id}`;
      let readTrackingEnabled = localStorage.getItem(readTrackingKey) !== 'false';
      const localReadIds = getLocalNotificationReadIds(user.id);

      // Fetch read receipts for this user only (best-effort)
      let readIds = new Set(localReadIds);
      if (readTrackingEnabled && dbNotificationIds.length > 0) {
        try {
          const { data: reads, error: readError } = await supabase
            .from('notification_reads')
            .select('notification_id')
            .eq('user_id', user.id)
            .in('notification_id', dbNotificationIds);

          if (!readError) {
            const dbReadIds = reads?.map((r) => r.notification_id) || [];
            readIds = new Set([...readIds, ...dbReadIds]);
            saveLocalNotificationReadIds(user.id, readIds);
          } else {
            readTrackingEnabled = false;
            localStorage.setItem(readTrackingKey, 'false');
          }
        } catch (readErr) {
          // Keep notifications usable even when read-receipt table is blocked.
          readTrackingEnabled = false;
          localStorage.setItem(readTrackingKey, 'false');
        }
      }

      const formattedData = finalNotifs.map((notif) => ({
        ...notif,
        isRead: readIds.has(notif.id),
      }));

      setNotifications(formattedData);
    } catch (err) {
      if (isFetchNetworkIssue(err)) {
        setNetworkBlocked(true);
        setNotifications([]);
        setError('');
      } else {
        setError('Failed to load notifications');
      }
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      if (!user?.id) return;

      const localReadIds = getLocalNotificationReadIds(user.id);
      localReadIds.add(notificationId);
      saveLocalNotificationReadIds(user.id, localReadIds);
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notificationId ? { ...notif, isRead: true } : notif
        )
      );

      const readTrackingKey = `notificationReadsEnabled_${user.id}`;
      if (localStorage.getItem(readTrackingKey) === 'false') return;
      if (!isUuid(notificationId)) return;

      // Check if already marked as read (best-effort)
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

        if (insertError) {
          localStorage.setItem(readTrackingKey, 'false');
          return;
        }
      }

    } catch (err) {
      // Keep silent here; notification content should remain usable even if read-write is blocked.
    }
  };

  const openNotification = async (notif) => {
    setSelectedNotification(notif);
    if (!notif.isRead) {
      await markAsRead(notif.id);
      setSelectedNotification((prev) => (prev?.id === notif.id ? { ...prev, isRead: true } : prev));
    }
  };

  const markAllAsRead = async () => {
    try {
      if (!user?.id) return;
      const unread = notifications.filter((n) => !n.isRead);
      if (!unread.length) return;

      const localReadIds = getLocalNotificationReadIds(user.id);
      unread.forEach((n) => localReadIds.add(n.id));
      saveLocalNotificationReadIds(user.id, localReadIds);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));

      const readTrackingKey = `notificationReadsEnabled_${user.id}`;
      if (localStorage.getItem(readTrackingKey) === 'false') return;

      const unreadDbIds = unread.map((n) => n.id).filter(isUuid);
      if (!unreadDbIds.length) return;

      const rows = unreadDbIds.map((id) => ({ notification_id: id, user_id: user.id }));
      const { error } = await supabase
        .from('notification_reads')
        .upsert(rows, { onConflict: 'notification_id,user_id' });

      if (error) {
        localStorage.setItem(readTrackingKey, 'false');
      }
    } catch (err) {
      // Keep UI responsive even when read tracking write fails.
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
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                {unreadCount} new
              </span>
            )}
            <button
              type="button"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Mark all as read
            </button>
          </div>
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
                onClick={() => openNotification(notif)}
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

      {selectedNotification && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedNotification(null)}
        >
          <div
            className={`w-full max-w-2xl border rounded-2xl shadow-2xl ${getTypeColor(selectedNotification.type)} bg-white`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between p-5 border-b border-slate-200">
              <div className="pr-4">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`px-3 py-1 text-xs font-medium rounded-full ${getTypeBadgeColor(
                      selectedNotification.type
                    )}`}
                  >
                    {selectedNotification.type.toUpperCase()}
                  </span>
                  {!selectedNotification.isRead && (
                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-slate-900">{selectedNotification.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNotification(null)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
                aria-label="Close notification"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">
                {selectedNotification.content}
              </p>
              <p className="text-xs text-slate-500 mt-6">
                {new Date(selectedNotification.created_at).toLocaleDateString()} at{' '}
                {new Date(selectedNotification.created_at).toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
