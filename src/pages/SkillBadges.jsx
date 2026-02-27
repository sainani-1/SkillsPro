import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { Award, Zap, Trophy, Lock } from 'lucide-react';

const SkillBadges = () => {
  const { profile } = useAuth();
  const [badges, setBadges] = useState([]);
  const [unlockedCount, setUnlockedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBadges = async () => {
      try {
        const allBadges = [
          {
            id: 1,
            name: 'Python Master',
            description: 'Score 90%+ on all Python courses',
            icon: '🐍',
            unlocked: true,
            unlockedDate: '2025-12-15'
          },
          {
            id: 2,
            name: 'Web Developer',
            description: 'Complete 3 web development courses',
            icon: '🌐',
            unlocked: true,
            unlockedDate: '2025-11-20'
          },
          {
            id: 3,
            name: 'Algorithm Expert',
            description: 'Solve 50 algorithm problems',
            icon: '⚡',
            unlocked: false,
            progress: 32
          },
          {
            id: 4,
            name: 'Full Stack Champion',
            description: 'Complete Frontend, Backend, and Database courses',
            icon: '🏆',
            unlocked: false,
            progress: 2
          },
          {
            id: 5,
            name: 'Consistent Learner',
            description: 'Learn for 90 consecutive days',
            icon: '📚',
            unlocked: false,
            progress: 67
          },
          {
            id: 6,
            name: 'Interview Ready',
            description: 'Pass 5 mock interviews with 80%+ score',
            icon: '💼',
            unlocked: false,
            progress: 1
          }
        ];

        setBadges(allBadges);
        setUnlockedCount(allBadges.filter(b => b.unlocked).length);
      } catch (err) {
        console.error('Error loading badges:', err);
      } finally {
        setLoading(false);
      }
    };

    if (profile) loadBadges();
  }, [profile]);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Award className="text-gold-400" size={32} />
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Skill Badges</h1>
          <p className="text-slate-600">Unlock achievements as you master skills</p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-gold-400 to-gold-500 text-white rounded-xl p-6">
        <div className="text-center">
          <p className="text-sm opacity-90">Total Unlocked</p>
          <p className="text-4xl font-bold">{unlockedCount}/{badges.length}</p>
          <p className="text-sm mt-2 opacity-90">{Math.round((unlockedCount/badges.length)*100)}% Complete</p>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner fullPage={false} message="Loading skill badges..." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {badges.map(badge => (
            <div
              key={badge.id}
              className={`p-6 rounded-xl border-2 transition-all ${
                badge.unlocked
                  ? 'bg-gold-50 border-gold-300'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="text-5xl mb-3">{badge.icon}</div>
              
              <h3 className="font-bold text-slate-900 mb-2">{badge.name}</h3>
              <p className="text-sm text-slate-600 mb-4">{badge.description}</p>

              {badge.unlocked ? (
                <div className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded inline-flex items-center gap-1">
                  <Trophy size={12} />
                  Unlocked {badge.unlockedDate}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Progress</span>
                    <span>{badge.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-300 rounded-full h-2">
                    <div
                      className="bg-gold-400 h-2 rounded-full transition-all"
                      style={{ width: `${badge.progress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SkillBadges;
