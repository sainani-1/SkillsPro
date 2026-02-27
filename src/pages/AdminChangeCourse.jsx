
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
  const [enrolling, setEnrolling] = useState(false);
  const [message, setMessage] = useState(null);

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
