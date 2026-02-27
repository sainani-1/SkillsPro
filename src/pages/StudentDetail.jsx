import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useParams } from 'react-router-dom';
import { Award, TrendingUp, BookOpen, Video, Calendar, CheckCircle, XCircle } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

const StudentDetail = () => {
  const { studentId } = useParams();
  const [student, setStudent] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [attendanceStats, setAttendanceStats] = useState({ total: 0, present: 0, absent: 0 });

  useEffect(() => {
    const load = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', studentId)
        .single();
      setStudent(profile);

      const { data: enr } = await supabase
        .from('enrollments')
        .select('*, courses(title, description)')
        .eq('student_id', studentId);
      setEnrollments(enr || []);

      const { data: certs } = await supabase
        .from('certificates')
        .select('*, courses(title), exam_submissions(score_percent)')
        .eq('user_id', studentId);
      setCertificates(certs || []);

      // Load class attendance - simplified query
      const { data: classAttendance, error: classError } = await supabase
        .from('class_attendance')
        .select('id, attended, marked_at, session_id')
        .eq('student_id', studentId)
        .order('marked_at', { ascending: false });

      // Load guidance attendance - simplified query
      const { data: guidanceAttendance, error: guidanceError } = await supabase
        .from('guidance_attendance')
        .select('id, attended, marked_at, session_id')
        .eq('student_id', studentId)
        .order('marked_at', { ascending: false });

      // Merge attendance without complex joins
      const allAttendance = [
        ...(classAttendance || []).map(a => ({ ...a, type: 'class' })),
        ...(guidanceAttendance || []).map(a => ({ ...a, type: 'guidance' }))
      ].sort((a, b) => new Date(b.marked_at) - new Date(a.marked_at));

      setAttendance(allAttendance);

      // Calculate stats
      const total = allAttendance.length;
      const present = allAttendance.filter(a => a.attended).length;
      const absent = total - present;
      setAttendanceStats({ total, present, absent });
    };
    load();
  }, [studentId]);

  if (!student) {
    return (
      <div className="bg-white rounded-xl p-8 text-center">
        <LoadingSpinner message="Loading student..." />
      </div>
    );
  }

  const isPremium = student.premium_until && new Date(student.premium_until) > new Date();

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-600 to-purple-700 p-6 rounded-xl text-white">
        <div className="flex items-center gap-4 mb-4">
          <img 
            src={student.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(student.full_name) + '&background=random'} 
            alt={student.full_name}
            className="w-20 h-20 rounded-full border-4 border-white object-cover"
            onError={(e) => {
              e.target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(student.full_name) + '&background=random';
            }}
          />
          <div>
            <h1 className="text-3xl font-bold">{student.full_name}</h1>
            <p className="text-blue-100">{student.email}</p>
            {student.phone && (
              <p className="text-blue-100">📞 {student.phone}</p>
            )}
            <p className="text-blue-100 mt-2 text-sm">
              <span className="font-semibold">Education:</span> {student.education_level}
              {student.study_stream && <span> • {student.study_stream}</span>}
            </p>
            {student.education_level === '12th' && student.diploma_certificate && (
              <p className="text-blue-100 mt-1 text-sm">
                <span className="font-semibold">Board Details:</span> {student.diploma_certificate}
              </p>
            )}
            {isPremium && (
              <span className="inline-flex items-center gap-1 bg-gold-500 text-white px-3 py-1 rounded-full text-sm mt-2">
                <Award size={16} /> Premium until {new Date(student.premium_until).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="text-blue-600" />
            <span className="font-semibold">Enrollments</span>
          </div>
          <p className="text-3xl font-bold text-blue-800">{enrollments.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="text-green-600" />
            <span className="font-semibold">Completed</span>
          </div>
          <p className="text-3xl font-bold text-green-800">
            {enrollments.filter(e => e.completed).length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border">
          <div className="flex items-center gap-2 mb-2">
            <Award className="text-gold-600" />
            <span className="font-semibold">Certificates</span>
          </div>
          <p className="text-3xl font-bold text-gold-800">{certificates.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="text-purple-600" />
            <span className="font-semibold">Attendance</span>
          </div>
          <p className="text-3xl font-bold text-purple-800">
            {attendanceStats.total > 0 ? Math.round((attendanceStats.present / attendanceStats.total) * 100) : 0}%
          </p>
          <p className="text-xs text-slate-500">{attendanceStats.present}/{attendanceStats.total} classes</p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border">
        <h2 className="text-xl font-bold mb-4">Course Enrollments</h2>
        <div className="space-y-3">
          {enrollments.map(enr => (
            <div key={enr.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Video className="text-blue-600" size={20} />
                <div>
                  <p className="font-semibold">{enr.courses?.title}</p>
                  <p className="text-xs text-slate-500">{enr.courses?.description}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="w-32 bg-slate-200 rounded-full h-2 mb-1">
                  <div 
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${enr.progress}%` }}
                  />
                </div>
                <p className="text-xs text-slate-600">{enr.progress}% complete</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border">
        <h2 className="text-xl font-bold mb-4">Certificates Earned</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {certificates.map(cert => (
            <div key={cert.id} className="border border-gold-200 bg-gold-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Award className="text-gold-600" size={20} />
                <h3 className="font-semibold">{cert.courses?.title}</h3>
              </div>
              <p className="text-sm text-slate-600 mb-1">
                Score: <span className="font-bold text-gold-800">{cert.exam_submissions?.[0]?.score_percent}%</span>
              </p>
              <p className="text-xs text-slate-500">
                Issued: {new Date(cert.issued_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Attendance Records</h2>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1">
              <CheckCircle size={16} className="text-green-600" />
              <span className="font-semibold text-green-600">{attendanceStats.present} Present</span>
            </div>
            <div className="flex items-center gap-1">
              <XCircle size={16} className="text-red-600" />
              <span className="font-semibold text-red-600">{attendanceStats.absent} Absent</span>
            </div>
          </div>
        </div>
        
        {attendance.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No attendance records found</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {attendance.map(record => (
              <div 
                key={record.id} 
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  record.attended 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  {record.attended ? (
                    <CheckCircle className="text-green-600" size={20} />
                  ) : (
                    <XCircle className="text-red-600" size={20} />
                  )}
                  <div>
                    <p className="font-semibold text-slate-800">
                      {record.type === 'class' ? 'Class Session' : 'Guidance Session'}
                    </p>
                    <p className="text-xs text-slate-600">
                      Session ID: {record.session_id}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-800">
                    {new Date(record.marked_at).toLocaleDateString('en-IN')}
                  </p>
                  <p className="text-xs text-slate-600">
                    {new Date(record.marked_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDetail;
