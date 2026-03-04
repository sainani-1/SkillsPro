
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const AdminChangeCourse = () => {
  const [userSearch, setUserSearch] = useState('');
  const [userOptions, setUserOptions] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userLoading, setUserLoading] = useState(false);
  const [enrollments, setEnrollments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [courseSearch, setCourseSearch] = useState('');
  const [courseOptions, setCourseOptions] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [globalCourseSearch, setGlobalCourseSearch] = useState('');
  const [globalCourseOptions, setGlobalCourseOptions] = useState([]);
  const [selectedGlobalCourse, setSelectedGlobalCourse] = useState(null);
  const [enrolling, setEnrolling] = useState(false);
  const [makingGlobalFree, setMakingGlobalFree] = useState(false);
  const [message, setMessage] = useState(null);

  const pushNotification = async (payload) => {
    try {
      const { error } = await supabase.from('admin_notifications').insert(payload);
      if (error && String(error.message || '').includes('target_user_id')) {
        const { target_user_id, ...fallback } = payload;
        const marker = target_user_id ? `[target_user_id:${target_user_id}] ` : '';
        await supabase.from('admin_notifications').insert({
          ...fallback,
          content:
            marker && !String(fallback.content || '').includes('[target_user_id:')
              ? `${marker}${fallback.content || ''}`
              : fallback.content,
        });
      }
    } catch {
      // Keep enrollment flow resilient even if notification insert fails.
    }
  };

  // Search users by email or name
  useEffect(() => {
    if (userSearch.length < 2) {
      setUserOptions([]);
      return;
    }
    setUserLoading(true);
    supabase
      .from('profiles')
      .select('id, full_name, email')
      .or(`email.ilike.%${userSearch}%,full_name.ilike.%${userSearch}%`)
      .eq('role', 'student')
      .limit(7)
      .then(({ data }) => {
        setUserOptions(data || []);
        setUserLoading(false);
      });
  }, [userSearch]);

  // Fetch user enrollments when selected
  useEffect(() => {
    if (!selectedUser) {
      setEnrollments([]);
      return;
    }
    supabase
      .from('enrollments')
      .select('id, course_id, courses(title)')
      .eq('student_id', selectedUser.id)
      .then(({ data }) => setEnrollments(data || []));
  }, [selectedUser]);

  // Fetch all courses (for search)
  useEffect(() => {
    supabase
      .from('courses')
      .select('id, title')
      .order('title', { ascending: true })
      .then(({ data }) => setCourses(data || []));
  }, []);

  // Filter courses by search
  useEffect(() => {
    if (!courseSearch) {
      setCourseOptions(courses);
    } else {
      setCourseOptions(
        courses.filter(c => c.title.toLowerCase().includes(courseSearch.toLowerCase()))
      );
    }
  }, [courseSearch, courses]);

  // Filter courses by search for global free action
  useEffect(() => {
    if (!globalCourseSearch) {
      setGlobalCourseOptions(courses);
    } else {
      setGlobalCourseOptions(
        courses.filter(c => c.title.toLowerCase().includes(globalCourseSearch.toLowerCase()))
      );
    }
  }, [globalCourseSearch, courses]);

  // Enroll user in course for free
  const handleEnroll = async () => {
    if (!selectedUser || !selectedCourse) return;
    setEnrolling(true);
    setMessage(null);
    // Check if already enrolled
    const already = enrollments.find(e => e.course_id === selectedCourse.id);
    if (already) {
      setMessage({ type: 'info', text: 'User is already enrolled in this course.' });
      setEnrolling(false);
      return;
    }
    // Insert enrollment
    const { error } = await supabase.from('enrollments').insert({
      student_id: selectedUser.id,
      course_id: selectedCourse.id,
      progress: 0,
      completed: false
    });
    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      await pushNotification({
        title: 'New Course Added',
        content: `You have been enrolled in "${selectedCourse.title}" by admin.`,
        type: 'success',
        target_role: 'student',
        target_user_id: selectedUser.id,
        admin_id: user?.id || null,
      });
      setMessage({ type: 'success', text: 'User enrolled in course for free!' });
      // Refresh enrollments
      supabase
        .from('enrollments')
        .select('id, course_id, courses(title)')
        .eq('student_id', selectedUser.id)
        .then(({ data }) => setEnrollments(data || []));
    }
    setEnrolling(false);
  };

  const handleMakeCourseFreeForAll = async () => {
    if (!selectedGlobalCourse) return;
    setMakingGlobalFree(true);
    setMessage(null);

    try {
      // 1) Mark as free for upcoming users
      const { error: courseUpdateError } = await supabase
        .from('courses')
        .update({ is_free: true })
        .eq('id', selectedGlobalCourse.id);

      if (courseUpdateError) throw courseUpdateError;

      // 2) Ensure existing students are enrolled
      const [{ data: students, error: studentsError }, { data: existingEnrollments, error: enrollmentsError }] =
        await Promise.all([
          supabase
            .from('profiles')
            .select('id')
            .eq('role', 'student'),
          supabase
            .from('enrollments')
            .select('student_id')
            .eq('course_id', selectedGlobalCourse.id),
        ]);

      if (studentsError) throw studentsError;
      if (enrollmentsError) throw enrollmentsError;

      const existingSet = new Set((existingEnrollments || []).map(e => e.student_id));
      const missingRows = (students || [])
        .filter(s => !existingSet.has(s.id))
        .map(s => ({
          student_id: s.id,
          course_id: selectedGlobalCourse.id,
          progress: 0,
          completed: false,
        }));

      if (missingRows.length > 0) {
        const chunkSize = 500;
        for (let i = 0; i < missingRows.length; i += chunkSize) {
          const chunk = missingRows.slice(i, i + chunkSize);
          const { error: insertError } = await supabase.from('enrollments').insert(chunk);
          if (insertError) throw insertError;
        }
      }

      // Keep local course list in sync
      setCourses(prev =>
        prev.map(c => (c.id === selectedGlobalCourse.id ? { ...c, is_free: true } : c))
      );

      setMessage({
        type: 'success',
        text: `"${selectedGlobalCourse.title}" is now free for all upcoming users, and enrolled for ${missingRows.length} existing students.`,
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to make course free for all users.' });
    } finally {
      setMakingGlobalFree(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8 bg-white rounded-xl shadow-md mt-10 space-y-8">
      <h1 className="text-3xl font-bold mb-2 text-blue-700">Admin: Change Course for Free</h1>
      <p className="text-slate-600 mb-4">Admins can change any user's course for free. Search and select a user, then enroll them in any course.</p>

      {/* User Search */}
      <div>
        <label className="block font-semibold mb-1">Search Student</label>
        <input
          type="text"
          className="w-full border rounded-lg p-2 mb-2"
          placeholder="Enter name or email..."
          value={userSearch}
          onChange={e => {
            setUserSearch(e.target.value);
            setSelectedUser(null);
            setEnrollments([]);
          }}
        />
        {userLoading && <div className="text-xs text-slate-500">Searching...</div>}
        {userOptions.length > 0 && !selectedUser && (
          <div className="border rounded-lg bg-white shadow max-h-40 overflow-y-auto">
            {userOptions.map(u => (
              <div
                key={u.id}
                className="p-2 hover:bg-blue-50 cursor-pointer"
                onClick={() => {
                  setSelectedUser(u);
                  setUserSearch(u.full_name + ' (' + u.email + ')');
                }}
              >
                <span className="font-medium">{u.full_name}</span> <span className="text-xs text-slate-500">{u.email}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User Enrollments */}
      {selectedUser && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="font-semibold mb-2">Current Enrollments for <span className="text-blue-700">{selectedUser.full_name}</span>:</div>
          {enrollments.length === 0 ? (
            <div className="text-slate-500 text-sm">No enrollments yet.</div>
          ) : (
            <ul className="list-disc ml-6 text-blue-900 text-sm">
              {enrollments.map(e => (
                <li key={e.id}>{e.courses?.title || 'Course #' + e.course_id}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Course Search & Select */}
      {selectedUser && (
        <div>
          <label className="block font-semibold mb-1">Select Course</label>
          <input
            type="text"
            className="w-full border rounded-lg p-2 mb-2"
            placeholder="Search course by title..."
            value={courseSearch}
            onChange={e => {
              setCourseSearch(e.target.value);
              setSelectedCourse(null);
            }}
          />
          {courseOptions.length > 0 && (
            <div className="border rounded-lg bg-white shadow max-h-40 overflow-y-auto">
              {courseOptions.map(c => (
                <div
                  key={c.id}
                  className={`p-2 hover:bg-blue-50 cursor-pointer ${selectedCourse?.id === c.id ? 'bg-blue-100' : ''}`}
                  onClick={() => setSelectedCourse(c)}
                >
                  {c.title}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Enroll Button */}
      {selectedUser && selectedCourse && (
        <button
          className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 mt-2"
          onClick={handleEnroll}
          disabled={enrolling}
        >
          {enrolling ? 'Enrolling...' : `Enroll ${selectedUser.full_name} in ${selectedCourse.title} for Free`}
        </button>
      )}

      {/* Global Free Course for all users */}
      <div className="border-t pt-6">
        <h2 className="text-xl font-bold text-emerald-700 mb-2">
          Make Course Free for All Users
        </h2>
        <p className="text-slate-600 mb-3 text-sm">
          Search a course and make it free for future users, then auto-enroll all existing students.
        </p>
        <label className="block font-semibold mb-1">Search Course</label>
        <input
          type="text"
          className="w-full border rounded-lg p-2 mb-2"
          placeholder="Search course by title..."
          value={globalCourseSearch}
          onChange={(e) => {
            setGlobalCourseSearch(e.target.value);
            setSelectedGlobalCourse(null);
          }}
        />
        {globalCourseOptions.length > 0 && (
          <div className="border rounded-lg bg-white shadow max-h-40 overflow-y-auto mb-3">
            {globalCourseOptions.map(c => (
              <div
                key={c.id}
                className={`p-2 hover:bg-emerald-50 cursor-pointer ${selectedGlobalCourse?.id === c.id ? 'bg-emerald-100' : ''}`}
                onClick={() => setSelectedGlobalCourse(c)}
              >
                {c.title}
              </div>
            ))}
          </div>
        )}
        <button
          className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50"
          onClick={handleMakeCourseFreeForAll}
          disabled={!selectedGlobalCourse || makingGlobalFree}
        >
          {makingGlobalFree
            ? 'Applying...'
            : selectedGlobalCourse
              ? `Make "${selectedGlobalCourse.title}" Free for All`
              : 'Select a Course'}
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`mt-4 p-3 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : message.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-blue-50 text-blue-800 border border-blue-200'}`}>
          {message.text}
        </div>
      )}
    </div>
  );
};

export default AdminChangeCourse;
