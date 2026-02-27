// Admin view for all contest scores
import React, { useEffect, useState } from 'react';
import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';

export default function AdminScoreboard() {
  const [scores, setScores] = useState([]);
  useEffect(() => {
    async function fetchScores() {
      const snap = await getDocs(collection(db, 'logicBuildingScores'));
      const arr = [];
      snap.forEach(doc => arr.push(doc.data()));
      // Group by email+name, sum scores
      const userMap = {};
      arr.forEach(s => {
        const key = (s.email || '') + '|' + (s.name || '');
        if (!userMap[key]) userMap[key] = { email: s.email || '', name: s.name || '', score: 0 };
        userMap[key].score += s.score || 0;
      });
      const users = Object.values(userMap);
      users.sort((a, b) => b.score - a.score);
      setScores(users);
    }
    fetchScores();
  }, []);
  return (
    <div style={{ maxWidth: '900px', margin: '2rem auto', background: '#fff', borderRadius: '1.5rem', boxShadow: '0 8px 32px rgba(99,102,241,0.10)', padding: '2.5rem', border: '2px solid #6366f1' }}>
      <h2 style={{ color: '#6366f1', fontWeight: 'bold', marginBottom: '2rem', textAlign: 'center' }}>Admin: Logic Building Contest Scoreboard</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '1.1rem' }}>
        <thead>
          <tr style={{ background: '#e0e7ff', color: '#334155' }}>
            <th style={{padding:'0.7rem'}}>Email</th>
            <th style={{padding:'0.7rem'}}>Name</th>
            <th style={{padding:'0.7rem'}}>Total Points</th>
          </tr>
        </thead>
        <tbody>
          {scores.map((s, idx) => (
            <tr key={idx} style={{ background: idx % 2 === 0 ? '#f3f4f6' : '#fff' }}>
              <td style={{padding:'0.7rem'}}>{s.email}</td>
              <td style={{padding:'0.7rem'}}>{s.name}</td>
              <td style={{padding:'0.7rem'}}>{s.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
