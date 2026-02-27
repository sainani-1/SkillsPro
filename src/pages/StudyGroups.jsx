import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Users, Video, MessageSquare, Plus, UserPlus } from 'lucide-react';
import usePopup from '../hooks/usePopup.jsx';

const StudyGroups = () => {
  const { profile } = useAuth();
  const { popupNode, openPopup } = usePopup();
  const [groups, setGroups] = useState([
    {
      id: 1,
      name: 'React & Web Dev',
      topic: 'Advanced React Patterns',
      members: ['Priya', 'Rahul', 'Isha', 'You'],
      active: true,
      nextSession: '2025-01-05 3PM IST'
    },
    {
      id: 2,
      name: 'System Design Masters',
      topic: 'Microservices Architecture',
      members: ['Arjun', 'Sana', 'You'],
      active: false,
      nextSession: '2025-01-08 7PM IST'
    }
  ]);

  const handleStartSession = (groupId) => {
    openPopup('Session starting', `Launching video session for group ${groupId}.`, 'success');
  };

  const handleCreateGroup = () => {
    openPopup('Create group', 'Group creation popup would open here.', 'info');
  };

  return (
    <div className="p-8 space-y-6">
      {popupNode}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="text-purple-600" size={32} />
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Study Groups</h1>
            <p className="text-slate-600">Collaborate and learn with peers in real-time</p>
          </div>
        </div>
        <button
          onClick={handleCreateGroup}
          className="flex items-center gap-2 bg-nani-dark text-white px-4 py-2 rounded-lg hover:bg-black"
        >
          <Plus size={18} />
          Create Group
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {groups.map(group => (
          <div
            key={group.id}
            className={`p-6 rounded-xl border-2 ${
              group.active
                ? 'bg-green-50 border-green-300'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">{group.name}</h3>
                <p className="text-sm text-slate-600 mt-1">{group.topic}</p>
              </div>
              {group.active && (
                <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded">
                  Active
                </span>
              )}
            </div>

            <div className="mb-4">
              <p className="text-xs text-slate-600 font-semibold mb-2">Members ({group.members.length})</p>
              <div className="flex flex-wrap gap-2">
                {group.members.map((member, i) => (
                  <span
                    key={i}
                    className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-full"
                  >
                    {member}
                  </span>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              📅 Next: {group.nextSession}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => handleStartSession(group.id)}
                className="flex-1 flex items-center justify-center gap-2 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700"
              >
                <Video size={16} />
                Start Session
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 border border-slate-300 py-2 rounded-lg hover:bg-slate-50">
                <MessageSquare size={16} />
                Chat
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
        <h3 className="font-bold text-slate-900 mb-2">Create Your Own Group</h3>
        <p className="text-slate-700 text-sm mb-4">
          Form a study group with peers, schedule sessions, share resources, and learn together.
        </p>
        <button className="flex items-center gap-2 bg-nani-dark text-white px-4 py-2 rounded-lg hover:bg-black">
          <UserPlus size={16} />
          Start a New Group
        </button>
      </div>
    </div>
  );
};

export default StudyGroups;
