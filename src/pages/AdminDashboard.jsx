import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import AlertModal from '../components/AlertModal';
import { Users, Calendar, Video, FileText, Plus, Award, TrendingUp, UserPlus, Check, X, AlertTriangle } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

const AdminDashboard = ({ initialTab = 'overview' }) => {
    const [activeTab, setActiveTab] = useState(initialTab);
    const [alertModal, setAlertModal] = useState({ show: false, title: '', message: '', type: 'info' });
    const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', onConfirm: null });
    const [stats, setStats] = useState({
      totalStudents: 0,
      premiumStudents: 0,
      totalTeachers: 0,
      totalCourses: 0,
      certificates: 0,
      pendingLeaves: 0
    });

    useEffect(() => {
        setActiveTab(initialTab);
        loadStats();
    }, [initialTab]);

    const loadStats = async () => {
      const { data: students } = await supabase.from('profiles').select('id, premium_until').eq('role', 'student');
      const { data: teachers } = await supabase.from('profiles').select('id').eq('role', 'teacher');
      const { data: courses } = await supabase.from('courses').select('id');
      const { data: certs } = await supabase.from('certificates').select('id');
      const { data: leaves } = await supabase.from('teacher_leaves').select('id').eq('status', 'pending');
      
      const premiumCount = students?.filter(s => s.premium_until && new Date(s.premium_until) > new Date()).length || 0;
      
      setStats({
        totalStudents: students?.length || 0,
        premiumStudents: premiumCount,
        totalTeachers: teachers?.length || 0,
        totalCourses: courses?.length || 0,
        certificates: certs?.length || 0,
        pendingLeaves: leaves?.length || 0
      });
    };

    if (activeTab === 'overview') {
      return (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-purple-600 to-blue-700 p-6 rounded-xl text-white">
            <h1 className="text-2xl font-bold mb-1">Admin Control Panel</h1>
            <p className="text-purple-100">Manage the entire SkillPro platform</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard icon={<Users className="text-blue-600" />} label="Students" value={stats.totalStudents} bgColor="bg-blue-50" />
            <StatCard icon={<Award className="text-gold-600" />} label="Premium" value={stats.premiumStudents} bgColor="bg-gold-50" />
            <StatCard icon={<UserPlus className="text-green-600" />} label="Teachers" value={stats.totalTeachers} bgColor="bg-green-50" />
            <StatCard icon={<Video className="text-purple-600" />} label="Courses" value={stats.totalCourses} bgColor="bg-purple-50" />
            <StatCard icon={<TrendingUp className="text-emerald-600" />} label="Certificates" value={stats.certificates} bgColor="bg-emerald-50" />
            <StatCard icon={<Calendar className="text-orange-600" />} label="Pending Leaves" value={stats.pendingLeaves} bgColor="bg-orange-50" />
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link to="/app/admin/student-progress" className="bg-white p-6 rounded-xl border hover:shadow-lg transition-shadow">
              <Users className="text-blue-600 mb-3" size={32} />
              <h3 className="font-bold mb-1">Student Progress</h3>
              <p className="text-xs text-slate-600">Track all student enrollments and certificates</p>
            </Link>
            <Link to="/app/admin/manage-premium" className="bg-white p-6 rounded-xl border hover:shadow-lg transition-shadow">
              <Award className="text-gold-600 mb-3" size={32} />
              <h3 className="font-bold mb-1">Manage Premium</h3>
              <p className="text-xs text-slate-600">Grant or revoke premium access</p>
            </Link>
            <Link to="/app/admin/teacher-assignment" className="bg-white p-6 rounded-xl border hover:shadow-lg transition-shadow">
              <UserPlus className="text-green-600 mb-3" size={32} />
              <h3 className="font-bold mb-1">Assign Teachers</h3>
              <p className="text-xs text-slate-600">Assign teachers to students</p>
            </Link>
            <Link to="/app/leaves" className="bg-white p-6 rounded-xl border hover:shadow-lg transition-shadow">
              <Calendar className="text-orange-600 mb-3" size={32} />
              <h3 className="font-bold mb-1">Leave Requests</h3>
              <p className="text-xs text-slate-600">Approve or reject teacher leaves</p>
            </Link>
          </div>
        </div>
      );
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Admin Control Panel</h1>
            <div className="flex space-x-4 border-b">
                <button onClick={() => setActiveTab('overview')} className={`pb-2 ${activeTab === 'overview' ? 'border-b-2 border-nani-accent font-bold' : ''}`}>Overview</button>
                <button onClick={() => setActiveTab('leaves')} className={`pb-2 ${activeTab === 'leaves' ? 'border-b-2 border-nani-accent font-bold' : ''}`}>Leave Requests</button>
                <button onClick={() => setActiveTab('monitor')} className={`pb-2 ${activeTab === 'monitor' ? 'border-b-2 border-nani-accent font-bold' : ''}`}>Class Monitor</button>
            </div>

            {activeTab === 'leaves' && <LeaveRequests />}
        </div>
    );
};

const StatCard = ({ icon, label, value, bgColor }) => (
  <div className={`${bgColor} p-4 rounded-xl border`}>
    <div className="flex items-center justify-between mb-2">
      {icon}
      <span className="text-2xl font-bold">{value}</span>
    </div>
    <p className="text-xs font-medium text-slate-700">{label}</p>
  </div>
);

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [certUpdatingUserId, setCertUpdatingUserId] = useState(null);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');

    useEffect(() => { loadUsers(); }, []);

    const loadUsers = async () => {
        setLoading(true);
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, full_name, email, role, phone, premium_until, is_locked, locked_until, avatar_url, core_subject')
          .order('full_name');

        const { data: certData } = await supabase
          .from('certificates')
          .select('user_id, revoked_at');

        const certMap = {};
        (certData || []).forEach(cert => {
          if (!certMap[cert.user_id]) {
            certMap[cert.user_id] = { total: 0, active: 0 };
          }
          certMap[cert.user_id].total += 1;
          if (!cert.revoked_at) certMap[cert.user_id].active += 1;
        });

        const merged = (profileData || []).map(u => ({
          ...u,
          certs: certMap[u.id] || { total: 0, active: 0 }
        }));

        setUsers(merged);
        setLoading(false);
    };

    const updateUserCertificates = async (user, action) => {
      const confirmText = action === 'block'
        ? 'Block all active certificates for this user?'
        : 'Unblock all certificates for this user?';
      if (!window.confirm(confirmText)) return;

      setCertUpdatingUserId(user.id);
      try {
        if (action === 'block') {
          const { error } = await supabase
            .from('certificates')
            .update({ revoked_at: new Date().toISOString() })
            .eq('user_id', user.id)
            .is('revoked_at', null);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('certificates')
            .update({ revoked_at: null })
            .eq('user_id', user.id);
          if (error) throw error;
        }

        await loadUsers();
      } catch (err) {
        console.error('Certificate update error:', err);
        alert(err.message || 'Failed to update certificates');
      } finally {
        setCertUpdatingUserId(null);
      }
    };

    const filtered = users.filter(u => {
      const matchesSearch = u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
                           u.email?.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });

    return (
      <div className="bg-white p-6 rounded-xl shadow-sm space-y-4">
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="font-bold">User Management</h3>
            <p className="text-xs text-slate-500">Students, teachers, and admins with status, premium, and lock info.</p>
          </div>
          <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => setRoleFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  roleFilter === 'all' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All Users ({users.length})
              </button>
              <button
                onClick={() => setRoleFilter('student')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  roleFilter === 'student' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Students ({users.filter(u => u.role === 'student').length})
              </button>
              <button
                onClick={() => setRoleFilter('teacher')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  roleFilter === 'teacher' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Teachers ({users.filter(u => u.role === 'teacher').length})
              </button>
              <button
                onClick={() => setRoleFilter('admin')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  roleFilter === 'admin' 
                    ? 'bg-red-600 text-white' 
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Admins ({users.filter(u => u.role === 'admin').length})
              </button>
            </div>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or email"
              className="px-3 py-2 border rounded-lg w-full md:w-64"
            />
          </div>
        </div>

        <AddTeacherForm />

        <div className="border border-slate-200 rounded-xl overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Phone</th>
                <th className="px-4 py-3 text-left">Subject</th>
                <th className="px-4 py-3 text-left">Premium</th>
                <th className="px-4 py-3 text-left">Lock</th>
                <th className="px-4 py-3 text-left">Certificates</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-6 text-center"><LoadingSpinner fullPage={false} message="Loading users..." /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-500">No users found</td></tr>
              ) : (
                filtered.map(u => {
                  const premiumActive = u.premium_until && new Date(u.premium_until) > new Date();
                  const hasCertificates = u.certs?.total > 0;
                  const hasActiveCertificates = u.certs?.active > 0;
                  return (
                    <tr key={u.id} className="border-t">
                      <td className="px-4 py-3 flex items-center gap-2">
                        <img
                          src={u.avatar_url || 'https://via.placeholder.com/32'}
                          alt={u.full_name}
                          className="w-8 h-8 rounded-full object-cover"
                          onError={e => { e.currentTarget.src = 'https://via.placeholder.com/32'; }}
                        />
                        <span className="font-semibold text-slate-800">{u.full_name}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          u.role === 'admin' ? 'bg-red-100 text-red-700' :
                          u.role === 'teacher' ? 'bg-blue-100 text-blue-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {u.role === 'admin' ? 'Nani' : u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{u.phone || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{u.core_subject || '—'}</td>
                      <td className="px-4 py-3">
                        {premiumActive ? (
                          <span className="text-xs text-gold-600 font-semibold">Until {new Date(u.premium_until).toLocaleDateString()}</span>
                        ) : (
                          <span className="text-xs text-slate-500">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {u.is_locked ? (
                          <span className="text-xs text-red-600 font-semibold">Locked{u.locked_until ? ` until ${new Date(u.locked_until).toLocaleDateString()}` : ''}</span>
                        ) : (
                          <span className="text-xs text-green-600 font-semibold">Active</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {hasCertificates ? (
                          <div className="flex flex-col gap-2">
                            <span className="text-xs text-slate-600">
                              Active {u.certs.active} / Total {u.certs.total}
                            </span>
                            <button
                              onClick={() => updateUserCertificates(u, hasActiveCertificates ? 'block' : 'unblock')}
                              disabled={certUpdatingUserId === u.id}
                              className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                                hasActiveCertificates
                                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                  : 'bg-green-100 text-green-700 hover:bg-green-200'
                              } disabled:opacity-60`}
                            >
                              {certUpdatingUserId === u.id
                                ? 'Updating...'
                                : hasActiveCertificates
                                ? 'Block Certificates'
                                : 'Unblock Certificates'}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">None</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
};

const AddTeacherForm = () => {
    const [form, setForm] = useState({ email: '', password: '', fullName: '', coreSubject: 'Computer Science' });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const endpoint = import.meta.env.VITE_ADMIN_CREATE_TEACHER_ENDPOINT || '/api/admin/create-teacher';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setLoading(true);
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: form.email,
                    password: form.password,
                    full_name: form.fullName,
                    core_subject: form.coreSubject,
                })
            });

            if (!res.ok) {
                const err = await res.text();
                throw new Error(err || 'Failed to create teacher');
            }

            setMessage('Teacher created. Refresh the list after your backend updates profiles.');
            setForm({ email: '', password: '', fullName: '', coreSubject: 'Computer Science' });
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3 border border-slate-200 rounded-xl p-4">
            <div className="col-span-full flex items-center gap-2 text-sm text-slate-500">
                <Plus size={14} />
                <span>Calls {endpoint}. Replace with your secured admin endpoint that uses the Supabase service role.</span>
            </div>
            <input className="p-3 border rounded-lg" placeholder="Teacher email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
            <input className="p-3 border rounded-lg" placeholder="Temp password" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
            <input className="p-3 border rounded-lg" placeholder="Full name" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} required />
            <select className="p-3 border rounded-lg" value={form.coreSubject} onChange={e => setForm({ ...form, coreSubject: e.target.value })}>
                <option>Computer Science</option>
                <option>Information Technology</option>
                <option>Electronics</option>
                <option>Mechanical</option>
                <option>Civil</option>
                <option>Business</option>
                <option>Design</option>
            </select>
            <div className="col-span-full flex items-center gap-3">
                <button disabled={loading} className="bg-nani-dark text-white px-4 py-2 rounded-lg text-sm hover:bg-nani-accent transition-colors disabled:opacity-60">
                    {loading ? 'Creating...' : 'Create Teacher'}
                </button>
                {message && <span className="text-xs text-slate-600">{message}</span>}
            </div>
        </form>
    );
};

const LeaveRequests = () => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [teachers, setTeachers] = useState([]);
  const [showReassignModal, setShowReassignModal] = useState(null);
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [reassignLoading, setReassignLoading] = useState(false);

  useEffect(() => {
    loadTeachers();
    loadLeaves();
  }, []);

  const loadTeachers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'teacher');

      if (error) throw error;
      setTeachers(data || []);
    } catch (err) {
      console.error('Error loading teachers:', err);
    }
  };

  const loadLeaves = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('teacher_leaves')
        .select('*, teacher:teacher_id(id, full_name, email)');

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setLeaves(data || []);
    } catch (err) {
      console.error('Error loading leaves:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaves();
  }, [filter]);

  const handleApproveWithReassignment = (leave) => {
    setShowReassignModal(leave);
    setSelectedTeacher('');
  };

  const performApprovalWithReassignment = async () => {
    if (!selectedTeacher) {
      setAlertModal({
        show: true,
        title: 'Missing Selection',
        message: 'Please select a teacher to reassign classes',
        type: 'warning'
      });
      return;
    }

    try {
      setReassignLoading(true);

      // Get all sessions for this teacher during the leave period
      const { data: sessions, error: sessionError } = await supabase
        .from('class_sessions')
        .select('*')
        .eq('teacher_id', showReassignModal.teacher_id)
        .gte('scheduled_for', new Date(showReassignModal.start_date).toISOString())
        .lte('scheduled_for', new Date(showReassignModal.end_date).toISOString());

      if (sessionError) throw sessionError;

      // Approve the leave
      const { error: leaveError } = await supabase
        .from('teacher_leaves')
        .update({
          status: 'approved',
          admin_comments: `Classes reassigned to ${teachers.find(t => t.id === selectedTeacher)?.full_name}`,
          decided_at: new Date().toISOString()
        })
        .eq('id', showReassignModal.id);

      if (leaveError) throw leaveError;

      // Reassign all sessions to the selected teacher
      if (sessions && sessions.length > 0) {
        const reassignments = sessions.map(session => ({
          session_id: session.id,
          original_teacher_id: showReassignModal.teacher_id,
          reassigned_to_teacher_id: selectedTeacher,
          leave_id: showReassignModal.id,
          reason: `Leave approved for ${showReassignModal.start_date} to ${showReassignModal.end_date}`
        }));

        const { error: reassignError } = await supabase
          .from('session_reassignments')
          .insert(reassignments);

        if (reassignError) throw reassignError;

        // Update class_sessions teacher_id
        const { error: updateError } = await supabase
          .from('class_sessions')
          .update({ teacher_id: selectedTeacher })
          .in('id', sessions.map(s => s.id));

        if (updateError) throw updateError;
      }

      setShowReassignModal(null);
      setSelectedTeacher('');
      await loadLeaves();
    } catch (err) {
      console.error('Error during approval and reassignment:', err);
      setAlertModal({
        show: true,
        title: 'Error',
        message: 'Error: ' + err.message,
        type: 'error'
      });
    } finally {
      setReassignLoading(false);
    }
  };

  const handleLeave = async (leaveId, status, comments = '') => {
    try {
      const { error } = await supabase
        .from('teacher_leaves')
        .update({
          status,
          admin_comments: comments || null,
          decided_at: new Date().toISOString()
        })
        .eq('id', leaveId);

      if (error) throw error;
      await loadLeaves();
    } catch (err) {
      console.error('Error updating leave:', err);
        setAlertModal({
          show: true,
          title: 'Error',
          message: 'Failed to update leave request',
          type: 'error'
        });
    }
  };

  const [revokeConfirmId, setRevokeConfirmId] = useState(null);

  const handleRevokeConfirm = async () => {
    if (!revokeConfirmId) return;
    
    try {
      const { error: updateError } = await supabase
        .from('teacher_leaves')
        .update({
          status: 'revoked',
          decided_at: new Date().toISOString()
        })
        .eq('id', revokeConfirmId);

      if (updateError) throw updateError;

      // Revert all reassignments for this leave
      const { data: reassignments, error: fetchError } = await supabase
        .from('session_reassignments')
        .select('session_id, original_teacher_id')
        .eq('leave_id', revokeConfirmId)
        .is('reverted_at', null);

      if (fetchError) throw fetchError;

      if (reassignments && reassignments.length > 0) {
        const originalTeacherId = reassignments[0].original_teacher_id;
        
        const { error: revertError } = await supabase
          .from('class_sessions')
          .update({ teacher_id: originalTeacherId })
          .in('id', reassignments.map(r => r.session_id));

        if (revertError) throw revertError;

        const { error: markRevertedError } = await supabase
          .from('session_reassignments')
          .update({ reverted_at: new Date().toISOString() })
          .eq('leave_id', revokeConfirmId);

        if (markRevertedError) throw markRevertedError;
      }
      
      // Success - just refresh, no alert
      await loadLeaves();
    } catch (err) {
      console.error('Error revoking leave:', err);
      setAlertModal({
        show: true,
        title: 'Error',
        message: 'Failed to revoke leave',
        type: 'error'
      });
    } finally {
      setRevokeConfirmId(null);
    }
  };

  const revokeLeave = async (leaveId) => {
    setConfirmModal({
      show: true,
      title: 'Confirm Revoke Leave',
      message: 'Are you sure you want to revoke this leave? The teacher\'s classes will be reverted to their original assignments.',
      onConfirm: () => {
        setRevokeConfirmId(leaveId);
        setConfirmModal({ show: false, title: '', message: '', onConfirm: null });
      }
    });
  };

  const pendingCount = leaves.filter(l => l.status === 'pending').length;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="font-bold text-lg">Teacher Leave Requests</h3>
          <p className="text-xs text-slate-500 mt-1">Approve or reject leave applications {pendingCount > 0 && `(${pendingCount} pending)`}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'pending', 'approved', 'rejected', 'revoked'].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Reassignment Modal */}
      {showReassignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4 text-slate-900">Reassign Classes During Leave</h3>
            <p className="text-sm text-slate-600 mb-4">
              Select a teacher to handle {showReassignModal.teacher?.full_name}'s classes from {new Date(showReassignModal.start_date).toLocaleDateString('en-IN')} to {new Date(showReassignModal.end_date).toLocaleDateString('en-IN')}
            </p>
            
            <select
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- Select Teacher --</option>
              {teachers.map(teacher => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.full_name}
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              <button
                onClick={performApprovalWithReassignment}
                disabled={reassignLoading || !selectedTeacher}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors font-medium"
              >
                {reassignLoading ? 'Processing...' : 'Approve & Reassign'}
              </button>
              <button
                onClick={() => setShowReassignModal(null)}
                disabled={reassignLoading}
                className="flex-1 bg-slate-300 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-400 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingSpinner fullPage={false} message="Loading leave requests..." />
      ) : leaves.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <Calendar className="w-12 h-12 mx-auto mb-2 opacity-40" />
          <p>No {filter !== 'all' ? filter : ''} leave requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leaves.map(leave => (
            <div key={leave.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">{leave.teacher?.full_name}</p>
                  <p className="text-xs text-slate-500">{leave.teacher?.email}</p>
                  <p className="text-sm text-slate-600 mt-1 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {new Date(leave.start_date).toLocaleDateString('en-IN')} to {new Date(leave.end_date).toLocaleDateString('en-IN')}
                    <span className="text-xs ml-1 text-slate-500">
                      ({Math.ceil((new Date(leave.end_date) - new Date(leave.start_date)) / (1000 * 60 * 60 * 24)) + 1} days)
                    </span>
                  </p>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full font-medium whitespace-nowrap ${
                  leave.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  leave.status === 'approved' ? 'bg-green-100 text-green-800' :
                  leave.status === 'rejected' ? 'bg-red-100 text-red-800' :
                  'bg-slate-100 text-slate-800'
                }`}>
                  {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                </span>
              </div>

              <p className="text-sm text-slate-700 mb-2"><strong>Reason:</strong> {leave.reason}</p>

              {leave.admin_comments && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3 text-sm">
                  <p className="font-medium text-blue-900">Admin Comments:</p>
                  <p className="text-blue-800">{leave.admin_comments}</p>
                </div>
              )}

              {leave.status === 'pending' && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => handleApproveWithReassignment(leave)}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 transition-colors flex-1"
                  >
                    <Check size={16} /> Approve (+ Reassign)
                  </button>
                  <button
                    onClick={() => {
                      const comments = window.prompt('Reason for rejection:');
                      if (comments) {
                        handleLeave(leave.id, 'rejected', comments);
                      }
                    }}
                    className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition-colors"
                  >
                    <X size={16} /> Reject
                  </button>
                </div>
              )}

              {leave.status === 'approved' && (
                <div className="pt-4 border-t border-slate-200">
                  <button
                    onClick={() => revokeLeave(leave.id)}
                    className="bg-slate-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700 transition-colors"
                  >
                    Revoke Leave (Revert Classes)
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <AlertModal 
        show={alertModal.show}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        onClose={() => setAlertModal({ show: false, title: '', message: '', type: 'info' })}
      />

      {confirmModal.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border-4 border-yellow-400">
            <h2 className="text-lg font-bold mb-4 text-slate-900 flex items-center gap-2">
              <AlertTriangle size={20} className="text-yellow-600" />
              {confirmModal.title}
            </h2>
            <p className="text-slate-700 mb-6">{confirmModal.message}</p>
            <div className="flex gap-2">
              <button
                onClick={confirmModal.onConfirm}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmModal({ show: false, title: '', message: '', onConfirm: null })}
                className="flex-1 bg-slate-300 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;