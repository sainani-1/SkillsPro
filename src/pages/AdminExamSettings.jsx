import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';
import { Save } from 'lucide-react';

const AdminExamSettings = () => {
  const [minQuestions, setMinQuestions] = useState(25);
  const [strictProctorLockDays, setStrictProctorLockDays] = useState(60);
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [minQuestionsByCourse, setMinQuestionsByCourse] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [savingCourse, setSavingCourse] = useState(false);

  useEffect(() => {
    loadSettings();
    loadCourses();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['min_questions', 'strict_proctor_lock_days']);
    if (error) setMessage('Error loading settings');
    else if (data && data.length > 0) {
      const settingsMap = Object.fromEntries((data || []).map((row) => [row.key, row.value]));
      setMinQuestions(parseInt(settingsMap.min_questions, 10) || 25);
      setStrictProctorLockDays(parseInt(settingsMap.strict_proctor_lock_days, 10) || 60);
    }
    setLoading(false);
  };

  const loadCourses = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('courses')
      .select('id, title, min_questions')
      .order('id');
    if (error) setMessage('Error loading courses');
    else {
      setCourses(data || []);
      const minMap = {};
      (data || []).forEach(c => {
        minMap[c.id] = c.min_questions || '';
      });
      setMinQuestionsByCourse(minMap);
      if (data && data.length > 0) setSelectedCourseId(data[0].id);
    }
    setLoading(false);
  };

  const saveSettings = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('settings')
      .upsert([
        { key: 'min_questions', value: minQuestions.toString() },
        { key: 'strict_proctor_lock_days', value: strictProctorLockDays.toString() }
      ], { onConflict: 'key' });
    if (error) setMessage('Error saving settings');
    else setMessage('Settings saved successfully!');
    setSaving(false);
    setTimeout(() => setMessage(''), 2000);
  };

  const handleCourseMinChange = (id, value) => {
    setMinQuestionsByCourse(prev => ({ ...prev, [id]: value }));
  };

  const saveSelectedCourseMinQuestions = async () => {
    if (!selectedCourseId) return;
    setSavingCourse(true);
    setMessage('');
    try {
      const min_questions = parseInt(minQuestionsByCourse[selectedCourseId]) || null;
      await supabase
        .from('courses')
        .update({ min_questions })
        .eq('id', selectedCourseId);
      setMessage('Course minimum questions updated!');
      loadCourses();
    } catch (err) {
      setMessage('Error saving course minimum questions');
    }
    setSavingCourse(false);
    setTimeout(() => setMessage(''), 2000);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow">
      <h1 className="text-2xl font-bold mb-4">Exam Settings</h1>
      <div className="mb-4">
        <label className="block text-sm font-semibold text-slate-700 mb-2">Minimum Questions Per Exam (Global)</label>
        <input
          type="number"
          className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={minQuestions}
          onChange={e => setMinQuestions(parseInt(e.target.value) || 1)}
          min="1"
          max="100"
        />
        <p className="text-xs text-slate-500 mt-1">Default minimum questions required for any exam.</p>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60 font-semibold mt-3"
        >
          <Save size={18} />
          {saving ? 'Saving...' : 'Save Global Setting'}
        </button>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-semibold text-slate-700 mb-2">Strict Proctor Lock Days</label>
        <input
          type="number"
          className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={strictProctorLockDays}
          onChange={e => setStrictProctorLockDays(parseInt(e.target.value, 10) || 1)}
          min="1"
          max="365"
        />
        <p className="text-xs text-slate-500 mt-1">
          Used when blank screen or strict proctoring violations lock a student account.
        </p>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-bold mb-2">Per-Course Minimum Questions</h2>
        <div className="mb-4">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Select Course</label>
          <select
            className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedCourseId || ''}
            onChange={e => setSelectedCourseId(parseInt(e.target.value))}
          >
            {courses.map(course => (
              <option key={course.id} value={course.id}>{course.title}</option>
            ))}
          </select>
        </div>
        {selectedCourseId && (
          <div className="bg-slate-50 p-4 rounded border border-slate-200 flex items-center gap-4">
            <div className="flex-1">
              <span className="font-semibold text-slate-900">
                {courses.find(c => c.id === selectedCourseId)?.title || ''}
              </span>
            </div>
            <div>
              <input
                type="number"
                className="w-24 p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={minQuestionsByCourse[selectedCourseId] || ''}
                onChange={e => handleCourseMinChange(selectedCourseId, parseInt(e.target.value) || '')}
                min="1"
                max="100"
              />
            </div>
          </div>
        )}
        <button
          onClick={saveSelectedCourseMinQuestions}
          disabled={savingCourse || !selectedCourseId}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60 font-semibold mt-4"
        >
          <Save size={18} />
          {savingCourse ? 'Saving...' : 'Save Per-Course Settings'}
        </button>
      </div>
      {message && <div className="mt-4 text-green-600 font-bold">{message}</div>}
    </div>
  );
};

export default AdminExamSettings;
