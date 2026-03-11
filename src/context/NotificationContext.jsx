import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import {
  getLocalNotificationReadIds,
  NOTIFICATION_READS_UPDATED_EVENT
} from '../utils/notificationReadState';

const NotificationContext = createContext({
  unreadNotifications: 0,
  refreshUnreadNotifications: async () => {},
  incrementUnreadNotifications: () => {},
});

const isFetchNetworkIssue = (err) => {
  const message = String(err?.message || '').toLowerCase();
  const details = String(err?.details || '').toLowerCase();
  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    details.includes('failed to fetch') ||
    details.includes('cors') ||
    message.includes('err_failed') ||
    message.includes('access to fetch') ||
    message.includes('525')
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

export const NotificationProvider = ({ children }) => {
  const { profile } = useAuth();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notificationPollingEnabled, setNotificationPollingEnabled] = useState(true);

  const refreshUnreadNotifications = async () => {
    if (!profile?.id || !profile?.role) {
      setUnreadNotifications(0);
      return;
    }

    try {
      const roleScopedRes = await supabase
        .from('admin_notifications')
        .select('id, content, created_at')
        .or(`target_role.eq.all,target_role.eq.${profile.role}`)
        .order('created_at', { ascending: false });

      const notifications = roleScopedRes.data || [];
      if (roleScopedRes.error) throw roleScopedRes.error;

      let visibleNotifications = notifications.filter((notification) => {
        const accountCreatedAt = profile?.created_at ? new Date(profile.created_at).getTime() : null;
        const notifCreatedAt = notification?.created_at ? new Date(notification.created_at).getTime() : null;
        if (
          accountCreatedAt &&
          notifCreatedAt &&
          Number.isFinite(accountCreatedAt) &&
          Number.isFinite(notifCreatedAt) &&
          notifCreatedAt < accountCreatedAt
        ) {
          return false;
        }
        const legacyTarget = extractLegacyTargetUserId(notification.content);
        return !legacyTarget || String(legacyTarget) === String(profile.id);
      });

      if (profile.role === 'student') {
        const { data: classRows, error: classErr } = await supabase
          .from('class_session_participants')
          .select('session_id')
          .eq('student_id', profile.id);
        if (!classErr && classRows?.length) {
          const synthetic = classRows.map((row) => ({ id: `class-session-${row.session_id}` }));
          const byId = new Map(visibleNotifications.map((notification) => [notification.id, notification]));
          synthetic.forEach((notification) => byId.set(notification.id, notification));
          visibleNotifications = Array.from(byId.values());
        }
      }

      if (!visibleNotifications.length) {
        setUnreadNotifications(0);
        return;
      }

      const dbNotificationIds = visibleNotifications.map((notification) => notification.id).filter(isUuid);
      const readTrackingKey = `notificationReadsEnabled_${profile.id}`;
      const readTrackingEnabled = localStorage.getItem(readTrackingKey) !== 'false';
      const localReadIds = getLocalNotificationReadIds(profile.id);

      if (!readTrackingEnabled) {
        setUnreadNotifications(visibleNotifications.filter((notification) => !localReadIds.has(notification.id)).length);
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
        setUnreadNotifications(visibleNotifications.filter((notification) => !localReadIds.has(notification.id)).length);
        return;
      }

      const readIds = new Set([...(reads || []).map((row) => row.notification_id), ...localReadIds]);
      setUnreadNotifications(visibleNotifications.filter((notification) => !readIds.has(notification.id)).length);
    } catch (error) {
      setUnreadNotifications(0);
      if (isFetchNetworkIssue(error)) {
        setNotificationPollingEnabled(false);
      }
    }
  };

  useEffect(() => {
    if (!profile?.id || !notificationPollingEnabled) return;

    refreshUnreadNotifications();
    const interval = setInterval(refreshUnreadNotifications, 60000);
    const onFocus = () => refreshUnreadNotifications();
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshUnreadNotifications();
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
  }, [profile?.id, profile?.role, notificationPollingEnabled]);

  useEffect(() => {
    setNotificationPollingEnabled(true);
  }, [profile?.id]);

  const value = useMemo(
    () => ({
      unreadNotifications,
      refreshUnreadNotifications,
      incrementUnreadNotifications: () => setUnreadNotifications((prev) => prev + 1),
    }),
    [unreadNotifications]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = () => useContext(NotificationContext);
