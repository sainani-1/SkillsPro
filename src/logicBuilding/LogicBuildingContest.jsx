// Contest participation UI for students/teachers
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from './firebase';
import { collection, doc, getDoc, setDoc, getDocs, updateDoc, increment } from 'firebase/firestore';
import { useEffect } from 'react';
import { isContestActive, getContestQuestions } from './contestModel';
import { weeklyContest } from './contestModel';
import { runCode } from './codeRunner';

export default function LogicBuildingContest() {
  const { profile, isPremium, loading } = useAuth();
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [results, setResults] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [contestActive, setContestActive] = useState(false);
  const [scoreMsg, setScoreMsg] = useState('');
  const [scoreboard, setScoreboard] = useState([]);

  React.useEffect(() => {
    async function checkActive() {
      await weeklyContest.load();
      setQuestions(weeklyContest.questions);
      const active = await isContestActive();
      setContestActive(active);
    }
    checkActive();
    const unsubscribe = weeklyContest.subscribe(async () => {
      setQuestions(weeklyContest.questions);
      const active = await isContestActive();
      setContestActive(active);
    });
    return () => unsubscribe && unsubscribe();
  }, []);

  async function handleRun() {
    if (!selectedQuestion) return;
    setScoreMsg('');
    const res = await runCode(language, code, selectedQuestion.testCases);
    setResults(res);
    // Check if all test cases passed
    const allPassed = res.every(r => r.status && r.status.toLowerCase().includes('accepted'));
    if (allPassed) {
      // Award random points between 16 and 20
      const points = Math.floor(Math.random() * 5) + 16;
      setScoreMsg(`Congratulations! All test cases passed. You earned ${points} points for this question.`);
      // Save/update score in Firestore (by user/question)
      // For demo, use localStorage for username
      let username = localStorage.getItem('logicbuilding_username');
      if (!username) {
        username = prompt('Enter your name for the scoreboard:');
        localStorage.setItem('logicbuilding_username', username);
      }
      const userRef = doc(db, 'logicBuildingScores', username);
      const userSnap = await getDoc(userRef);
      let prevScore = 0;
      if (userSnap.exists()) prevScore = userSnap.data().score || 0;
      await setDoc(userRef, { name: username, score: prevScore + points }, { merge: true });
      fetchScoreboard();
    }
  }

  async function fetchScoreboard() {
    const snap = await getDocs(collection(db, 'logicBuildingScores'));
    const arr = [];
    snap.forEach(doc => arr.push(doc.data()));
    arr.sort((a, b) => b.score - a.score);
    setScoreboard(arr);
  }

  useEffect(() => {
    fetchScoreboard();
  }, []);

  // Show loading while auth/profile is loading
  if (loading) return <div style={{minHeight:'40vh',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.3rem',color:'#6366f1'}}>Loading...</div>;

  // Restrict to premium users
  if (!isPremium(profile)) {
    return (
      <div style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%)',
        borderRadius: '2rem',
        boxShadow: '0 8px 32px rgba(99,102,241,0.10)',
        margin: '2rem',
        padding: '3rem',
        border: '2px solid #6366f1',
      }}>
        <h1 style={{ fontSize: '2.7rem', fontWeight: 'bold', color: '#6366f1', marginBottom: '1.2rem', letterSpacing: '1px' }}>Logic Building Contest</h1>
        <p style={{ fontSize: '1.3rem', color: '#334155', marginBottom: '1.5rem', textAlign: 'center' }}>
          <span style={{ color: '#dc2626', fontWeight: 'bold' }}>This contest is only available for premium students.</span><br/>
          <span style={{ color: '#64748b' }}>Upgrade to premium to participate in weekly coding contests and win rewards!</span>
        </p>
      </div>
    );
  }

  if (!contestActive) return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%)',
      borderRadius: '2rem',
      boxShadow: '0 8px 32px rgba(99,102,241,0.10)',
      margin: '2rem',
      padding: '3rem',
      border: '2px solid #6366f1',
    }}>
      <h1 style={{ fontSize: '2.7rem', fontWeight: 'bold', color: '#6366f1', marginBottom: '1.2rem', letterSpacing: '1px' }}>Logic Building Contest</h1>
      <p style={{ fontSize: '1.3rem', color: '#334155', marginBottom: '1.5rem', textAlign: 'center' }}>
        <span style={{ color: '#dc2626', fontWeight: 'bold' }}>Contest is not active right now.</span><br/>
        Next contest: <span style={{ color: '#6366f1', fontWeight: 'bold' }}>{weeklyContest.day}</span> <span style={{ color: '#6366f1', fontWeight: 'bold' }}>{weeklyContest.startTime} - {weeklyContest.endTime}</span>.<br/>
        <span style={{ color: '#64748b' }}>Stay tuned and come back during the contest window!</span>
      </p>
      <div style={{fontSize:'1.1rem',color:'#64748b',marginTop:'1rem',background:'#fff',padding:'1rem 2rem',borderRadius:'1rem',boxShadow:'0 2px 8px rgba(99,102,241,0.08)'}}>Practice your coding skills and get ready for the next challenge!</div>
    </div>
  );

  return (
    <div style={{
      maxWidth: '900px',
      margin: '2rem auto',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%)',
      borderRadius: '2rem',
      boxShadow: '0 8px 32px rgba(99,102,241,0.10)',
      padding: '2.5rem',
      border: '2px solid #6366f1',
    }}>
      <h2 style={{ fontSize: '2.2rem', fontWeight: 'bold', color: '#6366f1', marginBottom: '2rem', textAlign: 'center', letterSpacing: '1px' }}>Logic Building Weekly Contest</h2>
      <div style={{
        margin: '0 auto 2rem auto',
        background: 'linear-gradient(90deg, #fef9c3 0%, #fde68a 100%)',
        border: '2px solid #f59e42',
        borderRadius: '1.2rem',
        padding: '1.2rem 2rem',
        fontSize: '1.25rem',
        color: '#b45309',
        fontWeight: 'bold',
        textAlign: 'center',
        boxShadow: '0 2px 8px rgba(245,158,66,0.10)'
      }}>
        <span role="img" aria-label="star">⭐</span> Gain <span style={{color:'#ea580c'}}>1900 Rating</span> To Get <span style={{color:'#0ea5e9'}}>2 Months Extra Premium</span>!
      </div>
      <div style={{ marginBottom: '2rem', display: 'flex', gap: '1.5rem', alignItems: 'center', justifyContent: 'center' }}>
        <label style={{ fontWeight: 'bold', color: '#334155', fontSize: '1.1rem' }}>Select Question:</label>
        <select onChange={e => setSelectedQuestion(questions[e.target.value])} style={{ fontSize: '1.1rem', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', minWidth: '220px' }}>
          <option value="">-- Choose --</option>
          {questions.map((q, idx) => (
            <option value={idx} key={idx}>{q.title}</option>
          ))}
        </select>
      </div>
      {selectedQuestion && (
        <div style={{ background: '#fff', borderRadius: '1.2rem', boxShadow: '0 2px 8px rgba(99,102,241,0.08)', padding: '2rem', marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.5rem', color: '#6366f1', marginBottom: '1rem' }}>{selectedQuestion.title}</h3>
          <p style={{ fontSize: '1.1rem', color: '#334155', marginBottom: '1.5rem' }}>{selectedQuestion.description}</p>
          <textarea value={code} onChange={e => setCode(e.target.value)} placeholder="Write your code here..." style={{ width: '100%', minHeight: '120px', fontSize: '1.1rem', borderRadius: '0.7rem', border: '1px solid #cbd5e1', padding: '1rem', marginBottom: '1rem', background: '#f3f4f6' }} />
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
            <label style={{ fontWeight: 'bold', color: '#334155' }}>Language:</label>
            <select value={language} onChange={e => setLanguage(e.target.value)} style={{ fontSize: '1.1rem', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="cpp">C++</option>
              <option value="c">C</option>
            </select>
            <button onClick={handleRun} style={{ background: '#10b981', color: '#fff', fontWeight: 'bold', border: 'none', borderRadius: '0.7rem', padding: '0.7rem 2rem', fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 2px 8px rgba(16,185,129,0.15)' }}>Run & Test</button>
          </div>
          {scoreMsg && <div style={{margin:'1rem 0',color:'#10b981',fontWeight:'bold',fontSize:'1.2rem'}}>{scoreMsg}</div>}
          <div style={{ marginTop: '1.5rem' }}>
            <h4 style={{ color: '#6366f1', fontWeight: 'bold', marginBottom: '0.7rem' }}>Test Results</h4>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {results.length === 0 && <li style={{ color: '#64748b' }}>No test results yet. Click "Run & Test" to check your code.</li>}
              {results.map((r, idx) => (
                <li key={idx} style={{ background: r.hidden ? '#fca5a5' : '#a5b4fc', borderRadius: '0.5rem', padding: '0.7rem', marginBottom: '0.5rem', color: '#334155', fontWeight: 'bold' }}>
                  {r.hidden ? 'Hidden' : 'Shown'} Test: <span style={{ color: r.status && r.status.toLowerCase().includes('accepted') ? '#10b981' : '#dc2626' }}>{r.status}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {/* Scoreboard */}
      <div style={{ background: '#fff', borderRadius: '1.2rem', boxShadow: '0 2px 8px rgba(99,102,241,0.08)', padding: '2rem', marginBottom: '2rem' }}>
        <h3 style={{ color: '#6366f1', fontWeight: 'bold', marginBottom: '1rem' }}>Scoreboard</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '1.1rem' }}>
          <thead>
            <tr style={{ background: '#e0e7ff', color: '#334155' }}><th style={{padding:'0.7rem'}}>Name</th><th style={{padding:'0.7rem'}}>Score</th></tr>
          </thead>
          <tbody>
            {scoreboard.map((s, idx) => (
              <tr key={idx} style={{ background: idx % 2 === 0 ? '#f3f4f6' : '#fff' }}><td style={{padding:'0.7rem'}}>{s.name}</td><td style={{padding:'0.7rem'}}>{s.score}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
