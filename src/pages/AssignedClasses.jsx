import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Video, Calendar } from 'lucide-react';

const AssignedClasses = () => {
  const { profile } = useAuth();
  const [myClasses, setMyClasses] = useState([]);
  const [coveredClasses, setCoveredClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClasses = async () => {
      if (!profile) return;
      
      // My own classes
      const { data: own } = await supabase
        .from('class_sessions')
        .select('*')
        .eq('teacher_id', profile.id)
        .order('scheduled_for', { ascending: false });
      setMyClasses(own || []);

      // Classes assigned due to covering for other teachers on leave
      // This would require join with teacher_leaves and reassignment logic
      // For now, placeholder:
      setCoveredClasses([]);
      
      setLoading(false);
    };
    fetchClasses();
  }, [profile]);

  if (loading) return <div>Loading classes...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Assigned Classes</h1>
        <p className="text-slate-500">Your scheduled and covered classes</p>
      </div>

      <div>
        <h2 className="text-lg font-bold mb-3">My Classes</h2>
        {myClasses.length === 0 ? (
          <div className="bg-white p-4 rounded-xl border text-center text-slate-500 text-sm">
            No classes scheduled yet.
          </div>
        ) : (
          <div className="space-y-3">
            {myClasses.map(cls => (
              <div key={cls.id} className="bg-white p-4 rounded-xl border shadow-sm flex items-center gap-3">
                <Video className="text-blue-600" size={24} />
                <div className="flex-1">
                  <h3 className="font-semibold">{cls.title}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Calendar size={12} /> {new Date(cls.scheduled_for).toLocaleString()}
                  </p>
                </div>
                {cls.meeting_link ? (
                  <a
                    href={cls.meeting_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded hover:bg-blue-200"
                  >
                    Join
                  </a>
                ) : (
                  <a
                    href={`/live-class/${cls.id}`}
                    className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded hover:bg-blue-200"
                  >
                    Join
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {coveredClasses.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-3">Covering for Other Teachers</h2>
          <div className="space-y-3">
            {coveredClasses.map(cls => (
              <div key={cls.id} className="bg-orange-50 p-4 rounded-xl border border-orange-200 shadow-sm flex items-center gap-3">
                <Video className="text-orange-600" size={24} />
                <div className="flex-1">
                  <h3 className="font-semibold">{cls.title}</h3>
                  <p className="text-xs text-slate-600">Covering for: {cls.original_teacher}</p>
                  <p className="text-xs text-slate-500">{new Date(cls.scheduled_for).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignedClasses;
