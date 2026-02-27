import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Bell, Send, Trash2, Edit2 } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('info');
  const [targetRole, setTargetRole] = useState('all');
  const [loading, setLoading] = useState(false);
  const [fetchingNotifications, setFetchingNotifications] = useState(true);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setFetchingNotifications(true);
      const { data, error: fetchError } = await supabase
        .from('admin_notifications')
        .select('id, title, content, type, target_role, created_at, admin_id')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setNotifications(data || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError('Failed to fetch notifications');
    } finally {
      setFetchingNotifications(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const { data: userSession } = await supabase.auth.getSession();
      if (!userSession?.session?.user?.id) {
        setError('Not authenticated');
        return;
      }

      if (editId) {
        // Update existing notification
        const { error: updateError } = await supabase
          .from('admin_notifications')
          .update({
            title,
            content,
            type,
            target_role: targetRole,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editId);

        if (updateError) throw updateError;
        setEditId(null);
      } else {
        // Create new notification
        const { error: insertError } = await supabase
          .from('admin_notifications')
          .insert({
            admin_id: userSession.session.user.id,
            title,
            content,
            type,
            target_role: targetRole,
          });

        if (insertError) throw insertError;
      }

      setTitle('');
      setContent('');
      setType('info');
      setTargetRole('all');
      await fetchNotifications();
    } catch (err) {
      console.error('Error saving notification:', err);
      setError(err.message || 'Failed to save notification');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this notification?')) {
      try {
        const { error: deleteError } = await supabase
          .from('admin_notifications')
          .delete()
          .eq('id', id);

        if (deleteError) throw deleteError;
        await fetchNotifications();
      } catch (err) {
        console.error('Error deleting notification:', err);
        setError('Failed to delete notification');
      }
    }
  };

  const handleEdit = (notification) => {
    setEditId(notification.id);
    setTitle(notification.title);
    setContent(notification.content);
    setType(notification.type);
    setTargetRole(notification.target_role);
  };

  const handleCancel = () => {
    setEditId(null);
    setTitle('');
    setContent('');
    setType('info');
    setTargetRole('all');
    setError('');
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'success':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Bell className="w-8 h-8 text-amber-500" />
          <h1 className="text-4xl font-bold text-slate-900">Admin Notifications</h1>
        </div>

        {/* Create Notification Form */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">
            {editId ? 'Edit Notification' : 'Post New Notification'}
          </h2>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Notification title"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Content
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Notification content"
                rows="5"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="success">Success</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Target
                </label>
                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                >
                  <option value="all">All Users</option>
                  <option value="student">Students Only</option>
                  <option value="teacher">Teachers Only</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                <Send className="w-4 h-4" />
                {loading ? 'Posting...' : editId ? 'Update' : 'Post Notification'}
              </button>
              {editId && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Notifications List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-xl font-semibold text-slate-900">
              Recent Notifications ({notifications.length})
            </h2>
          </div>

          {fetchingNotifications ? (
            <LoadingSpinner fullPage={false} message="Loading notifications..." />
          ) : notifications.length === 0 ? (
            <div className="p-6 text-center text-slate-500">No notifications posted yet</div>
          ) : (
            <div className="divide-y divide-slate-200">
              {notifications.map((notif) => (
                <div key={notif.id} className="p-6 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${getTypeColor(notif.type)}`}>
                          {notif.type.toUpperCase()}
                        </span>
                        <span className="text-xs text-slate-500">
                          {notif.target_role === 'all' ? 'All Users' : notif.target_role === 'student' ? 'Students' : 'Teachers'}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-1">{notif.title}</h3>
                      <p className="text-slate-600 mb-3">{notif.content}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(notif.created_at).toLocaleDateString()} at{' '}
                        {new Date(notif.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(notif)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(notif.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
