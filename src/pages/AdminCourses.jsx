import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import AlertModal from '../components/AlertModal';
import { Save, RefreshCw, Edit2, X, Plus, Trash2, Award } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

const AdminCourses = () => {
  const [courses, setCourses] = useState([]);
  const [minQuestionsByCourse, setMinQuestionsByCourse] = useState({});
  const [exams, setExams] = useState({});
  const [questions, setQuestions] = useState({});
  const [submissions, setSubmissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [message, setMessage] = useState('');
  const [expandedCourse, setExpandedCourse] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState('overview');
  const [alertModal, setAlertModal] = useState({ show: false, title: '', message: '', type: 'info' });
  const [showNewCourseForm, setShowNewCourseForm] = useState(false);
  const [newCourse, setNewCourse] = useState({
    title: '',
    category: '',
    description: '',
    video_url: '',
    thumbnail_url: '',
    notes_url: '',
    is_free: false
  });
  const [deleteModal, setDeleteModal] = useState({ show: false, courseId: null, courseTitle: '' });
  const itemsPerPage = 4;

  const paginatedCourses = courses.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const totalPages = Math.ceil(courses.length / itemsPerPage);

  const loadData = async () => {
    setLoading(true);
    setMessage('');
    
    // Load courses
    const { data: coursesData, error: coursesError } = await supabase
      .from('courses')
      .select('*')
      .order('id');

    if (coursesError) {
      setMessage(coursesError.message);
    } else {
      setCourses(coursesData || []);
      // Load min_questions for each course
      const minMap = {};
      coursesData?.forEach(c => {
        minMap[c.id] = c.min_questions || null;
      });
      setMinQuestionsByCourse(minMap);
    }

    // Load exams
    const { data: examsData } = await supabase
      .from('exams')
      .select('*');
    
    const examsMap = {};
    examsData?.forEach(exam => {
      examsMap[exam.course_id] = exam;
    });
    setExams(examsMap);

    // Load exam questions
    const { data: questionsData } = await supabase
      .from('exam_questions')
      .select('*');
    
    const questionsMap = {};
    questionsData?.forEach(q => {
      if (!questionsMap[q.exam_id]) questionsMap[q.exam_id] = [];
      questionsMap[q.exam_id].push(q);
    });
    setQuestions(questionsMap);

    // Load submissions
    const { data: submissionsData } = await supabase
      .from('exam_submissions')
      .select('*, user:profiles(id, full_name, email)')
      .order('submitted_at', { ascending: false });
    
    const submissionsMap = {};
    submissionsData?.forEach(s => {
      if (!submissionsMap[s.exam_id]) submissionsMap[s.exam_id] = [];
      submissionsMap[s.exam_id].push(s);
    });
    setSubmissions(submissionsMap);
    
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCourseChange = (id, field, value) => {
    setCourses(prev => prev.map(c => {
      if (c.id === id) {
        // Ensure min_questions is always a number
        if (field === 'min_questions') {
          return { ...c, [field]: parseInt(value) || 1 };
        }
        return { ...c, [field]: value };
      }
      return c;
    }));
    if (field === 'min_questions') {
      setMinQuestionsByCourse(prev => ({ ...prev, [id]: value }));
    }
  };

  const handleExamChange = (courseId, field, value) => {
    setExams(prev => ({
      ...prev,
      [courseId]: {
        ...prev[courseId],
        [field]: value
      }
    }));
  };

  const handleSaveCourse = async (course) => {
    setSavingId(`course-${course.id}`);
    setMessage('');
    const { error } = await supabase
      .from('courses')
      .update({
        title: course.title,
        category: course.category,
        description: course.description,
        video_url: course.video_url,
        thumbnail_url: course.thumbnail_url,
        notes_url: course.notes_url,
        min_questions: typeof course.min_questions === 'number' ? course.min_questions : parseInt(course.min_questions) || 1
      })
      .eq('id', course.id);
    
    if (error) setMessage(`Error: ${error.message}`);
    else setMessage('✅ Course saved');
    
    setSavingId(null);
    setTimeout(() => setMessage(''), 2000);
  };

  const handleCreateCourse = async () => {
    if (!newCourse.title || !newCourse.category) {
      setAlertModal({
        show: true,
        title: 'Missing Information',
        message: 'Please provide at least course title and category',
        type: 'warning'
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('courses')
        .insert([{ ...newCourse, is_free: !!newCourse.is_free }])
        .select()
        .single();

      if (error) throw error;

      // Create default exam for the course
      await supabase
        .from('exams')
        .insert([{
          course_id: data.id,
          duration_minutes: 60,
          pass_percent: 70
        }]);

      setAlertModal({
        show: true,
        title: 'Success',
        message: 'Course created successfully!',
        type: 'success'
      });

      setShowNewCourseForm(false);
      setNewCourse({
        title: '',
        category: '',
        description: '',
        video_url: '',
        thumbnail_url: '',
        notes_url: '',
        is_free: false
      });
      loadData();
    } catch (error) {
      setAlertModal({
        show: true,
        title: 'Error',
        message: error.message,
        type: 'error'
      });
    }
  };

  const deleteCourse = async () => {
    const courseId = deleteModal.courseId;
    setDeleteModal({ show: false, courseId: null, courseTitle: '' });

    try {
      // Delete related data first
      const exam = exams[courseId];
      if (exam) {
        await supabase.from('exam_questions').delete().eq('exam_id', exam.id);
        await supabase.from('exam_submissions').delete().eq('exam_id', exam.id);
        await supabase.from('exams').delete().eq('id', exam.id);
      }

      // Delete course
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', courseId);

      if (error) throw error;

      setAlertModal({
        show: true,
        title: 'Success',
        message: 'Course deleted successfully',
        type: 'success'
      });

      loadData();
    } catch (error) {
      setAlertModal({
        show: true,
        title: 'Error',
        message: error.message,
        type: 'error'
      });
    }
  };

  const handleSaveExam = async (courseId) => {
    if (!exams[courseId]) return;
    
    setSavingId(`exam-${courseId}`);
    setMessage('');
    const exam = exams[courseId];
    
    const { error } = await supabase
      .from('exams')
      .update({
        duration_minutes: parseInt(exam.duration_minutes),
        pass_percent: parseInt(exam.pass_percent)
      })
      .eq('id', exam.id);
    
    if (error) setMessage(`Error: ${error.message}`);
    else setMessage('✅ Exam settings saved');
    
    setSavingId(null);
    setTimeout(() => setMessage(''), 2000);
  };

  const handleQuestionChange = (examId, index, field, value) => {
    setQuestions(prev => ({
      ...prev,
      [examId]: (prev[examId] || []).map((q, i) => 
        i === index ? { ...q, [field]: value } : q
      )
    }));
  };

  const handleOptionChange = (examId, qIndex, optIndex, value) => {
    setQuestions(prev => ({
      ...prev,
      [examId]: (prev[examId] || []).map((q, i) => {
        if (i === qIndex) {
          const newOptions = [...(q.options || [])];
          newOptions[optIndex] = value;
          return { ...q, options: newOptions };
        }
        return q;
      })
    }));
  };

  const addQuestion = (examId) => {
    setQuestions(prev => ({
      ...prev,
      [examId]: [
        ...(prev[examId] || []),
        { exam_id: examId, question: '', options: ['', '', '', ''], correct_index: 0, order_index: (prev[examId]?.length || 0) }
      ]
    }));
  };

  const deleteQuestion = (examId, index) => {
    setQuestions(prev => ({
      ...prev,
      [examId]: (prev[examId] || []).filter((_, i) => i !== index)
    }));
  };

  const handleSaveQuestions = async (examId) => {
    if (!questions[examId]) return;

    setSavingId(`questions-${examId}`);
    setMessage('');

    try {
      const { error: deleteError } = await supabase
        .from('exam_questions')
        .delete()
        .eq('exam_id', examId);

      if (deleteError) throw deleteError;

      const questionsToInsert = questions[examId].map((q, idx) => ({
        exam_id: examId,
        question: q.question,
        options: q.options,
        correct_index: q.correct_index,
        order_index: idx
      }));

      const { error: insertError } = await supabase
        .from('exam_questions')
        .insert(questionsToInsert);

      if (insertError) throw insertError;
      setMessage('✅ Questions saved successfully');
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }

    setSavingId(null);
    setTimeout(() => setMessage(''), 2000);
  };

  const generateCertificate = async (submission) => {
    if (!submission.passed) {
      setAlertModal({
        show: true,
        title: 'Cannot Generate Certificate',
        message: 'Certificate can only be generated for passed exams',
        type: 'warning'
      });
      return;
    }

    try {
      setSavingId(`cert-${submission.id}`);
      const courseId = Object.values(exams).find(e => e.id === submission.exam_id)?.course_id;
      
      const { error } = await supabase
        .from('certificates')
        .insert({
          user_id: submission.user_id,
          course_id: courseId,
          exam_submission_id: submission.id,
          issued_at: new Date().toISOString()
        });

      if (error) {
        if (error.code === '23505') {
          setAlertModal({
            show: true,
            title: 'Certificate Exists',
            message: 'Certificate already exists for this submission',
            type: 'info'
          });
        } else {
          throw error;
        }
      } else {
        setAlertModal({
          show: true,
          title: 'Success',
          message: 'Certificate generated successfully',
          type: 'success'
        });
      }
    } catch (err) {
      setAlertModal({
        show: true,
        title: 'Error',
        message: `Error generating certificate: ${err.message}`,
        type: 'error'
      });
    } finally {
      setSavingId(null);
    }
  };

  const openCourseDetail = (course) => {
    setSelectedCourse(course);
    setActiveTab('overview');
  };

  const closeCourseDetail = () => {
    setSelectedCourse(null);
    setActiveTab('overview');
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <AlertModal 
        show={alertModal.show}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        onClose={() => setAlertModal({ show: false, title: '', message: '', type: 'info' })}
      />
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6 p-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Admin Course Management</h1>
            <p className="text-slate-500 text-sm">Edit course details, exam duration, and video links</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={loadData} 
              className="flex items-center gap-2 text-sm bg-white border px-3 py-2 rounded-lg hover:bg-slate-50"
            >
              <RefreshCw size={16} /> Refresh
            </button>
            <button 
              onClick={() => setShowNewCourseForm(true)} 
              className="flex items-center gap-2 text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Plus size={16} /> Add New Course
            </button>
          </div>
        </div>

      {message && (
        <div className={`text-sm p-3 rounded-lg ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {message}
        </div>
      )}

      {loading ? (
        <LoadingSpinner message="Loading courses and exams..." />
      ) : courses.length === 0 ? (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-center">
          No courses found
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4">
            {paginatedCourses.map(course => (
              <div key={course.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Course Header */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-slate-50 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => setExpandedCourse(expandedCourse === course.id ? null : course.id)}>
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-slate-900">{course.title || 'Untitled Course'}</h3>
                  <p className="text-sm text-slate-600">ID: {course.id} • Category: {course.category}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();                      setDeleteModal({ show: true, courseId: course.id, courseTitle: course.title });
                    }}
                    className="flex items-center gap-1 bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700 transition-colors font-semibold"
                    title="Delete Course"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();                      openCourseDetail(course);
                    }}
                    className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 transition-colors font-semibold"
                  >
                    <Edit2 size={14} /> Details
                  </button>
                  <span className="text-blue-600 font-semibold text-sm">
                    {expandedCourse === course.id ? '▼' : '▶'}
                  </span>
                </div>
              </div>

              {/* Expanded Course Details */}
              {expandedCourse === course.id && (
                <div className="border-t border-slate-200 p-6 space-y-6">
                  {/* Course Information */}
                  <div className="space-y-4">
                    <h4 className="font-bold text-slate-900 flex items-center gap-2">
                      <Edit2 size={16} /> Course Information
                    </h4>
                    
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Course Title</label>
                        <input
                          type="text"
                          className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={course.title || ''}
                          onChange={e => handleCourseChange(course.id, 'title', e.target.value)}
                          placeholder="Enter course title"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Category</label>
                        <input
                          type="text"
                          className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={course.category || ''}
                          onChange={e => handleCourseChange(course.id, 'category', e.target.value)}
                          placeholder="e.g., Web Development"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Course Image URL</label>
                      <input
                        type="url"
                        className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={course.thumbnail_url || ''}
                        onChange={e => handleCourseChange(course.id, 'thumbnail_url', e.target.value)}
                        placeholder="https://example.com/image.jpg"
                      />
                      <p className="text-xs text-slate-500 mt-1">Direct image URL or Google Drive shared link</p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Video Link (YouTube or Drive Iframe)</label>
                      <textarea
                        className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={course.video_url || ''}
                        onChange={e => handleCourseChange(course.id, 'video_url', e.target.value)}
                        placeholder="YouTube URL or Drive iframe embed code"
                        rows="3"
                      />
                      <p className="text-xs text-slate-500 mt-1">For Drive: Share → Embed → Copy entire iframe code</p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Description</label>
                      <textarea
                        className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={course.description || ''}
                        onChange={e => handleCourseChange(course.id, 'description', e.target.value)}
                        placeholder="Enter course description"
                        rows="3"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Notes/Study Material Link</label>
                      <input
                        type="url"
                        className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={course.notes_url || ''}
                        onChange={e => handleCourseChange(course.id, 'notes_url', e.target.value)}
                        placeholder="https://drive.google.com/... or https://docs.google.com/..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Description/Notes</label>
                      <textarea
                        className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-24"
                        value={course.description || ''}
                        onChange={e => handleCourseChange(course.id, 'description', e.target.value)}
                        placeholder="Course description and important notes..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Minimum Questions for This Course</label>
                      <input
                        type="number"
                        className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={minQuestionsByCourse[course.id] || ''}
                        onChange={e => handleCourseChange(course.id, 'min_questions', parseInt(e.target.value) || 1)}
                        min="1"
                        max="100"
                      />
                      <p className="text-xs text-slate-500 mt-1">Override global minimum for this course.</p>
                    </div>
                    <button
                      onClick={() => handleSaveCourse(course)}
                      disabled={savingId === `course-${course.id}`}
                      className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60 font-semibold"
                    >
                      <Save size={18} />
                      {savingId === `course-${course.id}` ? 'Saving...' : 'Save Course'}
                    </button>
                  </div>

                  {/* Exam Settings */}
                  {exams[course.id] && (
                    <div className="border-t pt-6 space-y-4">
                      <h4 className="font-bold text-slate-900 flex items-center gap-2">
                        <Edit2 size={16} /> Exam Settings
                      </h4>
                      
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">Exam Duration (minutes)</label>
                          <input
                            type="number"
                            className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            value={exams[course.id].duration_minutes || 100}
                            onChange={e => handleExamChange(course.id, 'duration_minutes', e.target.value)}
                            min="1"
                            max="600"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">Pass Percentage (%)</label>
                          <input
                            type="number"
                            className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            value={exams[course.id].pass_percent || 70}
                            onChange={e => handleExamChange(course.id, 'pass_percent', e.target.value)}
                            min="0"
                            max="100"
                          />
                        </div>
                      </div>

                      <button
                        onClick={() => handleSaveExam(course.id)}
                        disabled={savingId === `exam-${course.id}`}
                        className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-60 font-semibold"
                      >
                        <Save size={18} />
                        {savingId === `exam-${course.id}` ? 'Saving...' : 'Save Exam Settings'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                ← Previous
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-2 rounded-lg font-semibold transition-colors ${
                      currentPage === page
                        ? 'bg-blue-600 text-white'
                        : 'border border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                Next →
              </button>
              
              <span className="ml-4 text-sm text-slate-600 font-semibold">
                Page {currentPage} of {totalPages}
              </span>
            </div>
          )}
        </div>
      )}
      </div>

      {/* Side Panel */}
      {selectedCourse && (
        <div className="w-96 bg-white border-l border-slate-200 shadow-lg flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white flex items-center justify-between">
            <h2 className="font-bold text-lg">{selectedCourse.title}</h2>
            <button
              onClick={closeCourseDetail}
              className="p-1 hover:bg-blue-600 rounded transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b px-4 pt-4">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-2 font-semibold text-sm transition-colors ${
                activeTab === 'overview'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('questions')}
              className={`px-3 py-2 font-semibold text-sm transition-colors ${
                activeTab === 'questions'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Questions
            </button>
            <button
              onClick={() => setActiveTab('results')}
              className={`px-3 py-2 font-semibold text-sm transition-colors ${
                activeTab === 'results'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Results
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Video Link</label>
                  <input
                    type="url"
                    className="w-full text-xs p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={selectedCourse.video_url || ''}
                    onChange={e => {
                      setCourses(prev => prev.map(c => c.id === selectedCourse.id ? { ...c, video_url: e.target.value } : c));
                      setSelectedCourse(prev => ({ ...prev, video_url: e.target.value }));
                    }}
                    placeholder="https://youtube.com/..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Notes/Study Material Link</label>
                  <input
                    type="url"
                    className="w-full text-xs p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={selectedCourse.notes_url || ''}
                    onChange={e => {
                      setCourses(prev => prev.map(c => c.id === selectedCourse.id ? { ...c, notes_url: e.target.value } : c));
                      setSelectedCourse(prev => ({ ...prev, notes_url: e.target.value }));
                    }}
                    placeholder="https://drive.google.com/... or https://docs.google.com/..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                  <textarea
                    className="w-full text-xs p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-16"
                    value={selectedCourse.description || ''}
                    onChange={e => {
                      setCourses(prev => prev.map(c => c.id === selectedCourse.id ? { ...c, description: e.target.value } : c));
                      setSelectedCourse(prev => ({ ...prev, description: e.target.value }));
                    }}
                    placeholder="Course description..."
                  />
                </div>

                <button
                  onClick={() => handleSaveCourse(selectedCourse)}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 transition-colors font-semibold"
                >
                  <Save size={16} /> Save Overview
                </button>
              </div>
            )}

            {/* Questions Tab */}
            {activeTab === 'questions' && exams[selectedCourse.id] && (
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900">Exam Questions ({(questions[exams[selectedCourse.id].id] || []).length})</h3>
                
                {(questions[exams[selectedCourse.id].id] || []).map((q, idx) => (
                  <div key={idx} className="bg-slate-50 p-3 rounded border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-700 bg-slate-200 px-2 py-1 rounded">Q{idx + 1}</span>
                      <button
                        onClick={() => deleteQuestion(exams[selectedCourse.id].id, idx)}
                        className="text-red-600 hover:text-red-700 p-1 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-600 block mb-1">Question Text</label>
                      <input
                        type="text"
                        className="w-full text-xs p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={q.question || ''}
                        onChange={e => handleQuestionChange(exams[selectedCourse.id].id, idx, 'question', e.target.value)}
                        placeholder="Enter question..."
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-600 block">Options (Select correct answer)</label>
                      {(q.options || []).map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center gap-2 p-2 rounded border border-slate-200 hover:bg-white transition-colors"
                          style={q.correct_index === oIdx ? { backgroundColor: '#dcfce7', borderColor: '#22c55e' } : {}}>
                          <input
                            type="radio"
                            name={`correct-${idx}`}
                            checked={q.correct_index === oIdx}
                            onChange={() => handleQuestionChange(exams[selectedCourse.id].id, idx, 'correct_index', oIdx)}
                            className="w-3 h-3 cursor-pointer"
                          />
                          <input
                            type="text"
                            className="flex-1 text-xs p-1.5 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                            value={opt}
                            onChange={e => handleOptionChange(exams[selectedCourse.id].id, idx, oIdx, e.target.value)}
                            placeholder={`Option ${oIdx + 1}`}
                          />
                          {q.correct_index === oIdx && (
                            <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded">✓ Correct</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {(questions[exams[selectedCourse.id].id] || []).length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    <p className="text-sm mb-3">No questions added yet</p>
                  </div>
                )}

                <button
                  onClick={() => addQuestion(exams[selectedCourse.id].id)}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700 transition-colors font-semibold"
                >
                  <Plus size={16} /> Add Question
                </button>

                <button
                  onClick={() => handleSaveQuestions(exams[selectedCourse.id].id)}
                  disabled={savingId === `questions-${exams[selectedCourse.id].id}`}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 transition-colors font-semibold disabled:opacity-60"
                >
                  <Save size={16} /> {savingId === `questions-${exams[selectedCourse.id].id}` ? 'Saving...' : 'Save All Questions'}
                </button>
              </div>
            )}

            {/* Results Tab */}
            {activeTab === 'results' && exams[selectedCourse.id] && (
              <div className="space-y-3">
                <h3 className="font-semibold text-slate-900">Student Results</h3>
                
                {(submissions[exams[selectedCourse.id].id] || []).length === 0 ? (
                  <p className="text-xs text-slate-600 text-center py-4">No submissions yet</p>
                ) : (
                  (submissions[exams[selectedCourse.id].id] || []).map(sub => (
                    <div key={sub.id} className="bg-slate-50 p-3 rounded border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-xs font-semibold text-slate-900">{sub.user?.full_name}</p>
                          <p className="text-xs text-slate-600">{sub.user?.email}</p>
                        </div>
                        {sub.passed ? (
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">
                            Passed
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded">
                            Failed
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-600">
                        <p>Score: <span className="font-semibold">{Math.round(sub.score_percent || 0)}%</span></p>
                        <p>Submitted: {new Date(sub.submitted_at).toLocaleDateString()}</p>
                      </div>

                      {sub.passed && (
                        <button
                          onClick={() => generateCertificate(sub)}
                          disabled={savingId === `cert-${sub.id}`}
                          className="w-full flex items-center justify-center gap-1 bg-amber-600 text-white px-2 py-1.5 rounded text-xs hover:bg-amber-700 transition-colors font-semibold disabled:opacity-60"
                        >
                          <Award size={14} /> {savingId === `cert-${sub.id}` ? 'Generating...' : 'Generate Certificate'}
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Course Form Modal */}
      {showNewCourseForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold mb-6 text-slate-900">Create New Course</h3>
            
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Course Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newCourse.title}
                  onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                  placeholder="e.g., Introduction to Python Programming"
                  className="w-full p-2 border border-slate-300 rounded"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newCourse.category}
                  onChange={(e) => setNewCourse({ ...newCourse, category: e.target.value })}
                  placeholder="e.g., Programming, Web Development, Data Science"
                  className="w-full p-2 border border-slate-300 rounded"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newCourse.description}
                  onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                  placeholder="Course overview, what students will learn..."
                  rows="3"
                  className="w-full p-2 border border-slate-300 rounded"
                />
              </div>

              {/* Image URL */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Image URL
                </label>
                <input
                  type="url"
                  value={newCourse.thumbnail_url}
                  onChange={(e) => setNewCourse({ ...newCourse, thumbnail_url: e.target.value })}
                  placeholder="https://example.com/course-image.jpg"
                  className="w-full p-2 border border-slate-300 rounded"
                />
                <p className="text-xs text-slate-500 mt-1">Direct image URL or Google Drive shared link</p>
              </div>

              {/* Video URL / Iframe */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Video URL or Embed Code
                </label>
                <textarea
                  value={newCourse.video_url}
                  onChange={(e) => setNewCourse({ ...newCourse, video_url: e.target.value })}
                  placeholder="YouTube URL or Google Drive iframe embed code"
                  rows="3"
                  className="w-full p-2 border border-slate-300 rounded font-mono text-sm"
                />
                <p className="text-xs text-slate-500 mt-1">
                  For Drive: Right-click video → Share → Get embed code → Copy entire &lt;iframe&gt; tag
                </p>
              </div>

              {/* Notes URL */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Notes/PDF URL
                </label>
                <input
                  type="url"
                  value={newCourse.notes_url}
                  onChange={(e) => setNewCourse({ ...newCourse, notes_url: e.target.value })}
                  placeholder="https://example.com/course-notes.pdf"
                  className="w-full p-2 border border-slate-300 rounded"
                />
              </div>

              {/* Free/Paid Toggle */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Course Type
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!newCourse.is_free}
                      onChange={e => setNewCourse({ ...newCourse, is_free: e.target.checked })}
                      className="form-checkbox h-5 w-5 text-blue-600"
                    />
                    <span className="text-blue-700 font-semibold">Free Course</span>
                  </label>
                  <span className="text-slate-500 text-xs">If checked, anyone can access this course without premium.</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowNewCourseForm(false);
                  setNewCourse({ title: '', category: '', description: '', video_url: '', thumbnail_url: '', notes_url: '' });
                }}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded hover:bg-slate-50 transition-colors font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCourse}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-semibold"
              >
                Create Course
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4 text-red-600">Delete Course?</h3>
            <p className="text-slate-700 mb-2">
              Are you sure you want to delete <strong>{deleteModal.courseTitle}</strong>?
            </p>
            <p className="text-sm text-red-600 mb-6">
              ⚠️ This action cannot be undone. All related exams, questions, and student submissions will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal({ show: false, courseId: null, courseTitle: '' })}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded hover:bg-slate-50 transition-colors font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={deleteCourse}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors font-semibold"
              >
                Delete Course
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCourses;
