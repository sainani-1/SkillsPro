// Scoreboard for weekly contest
import React, { useEffect, useState } from 'react';

// Dummy data, replace with real DB fetch
const scores = [
  { name: 'Alice', score: 120 },
  { name: 'Bob', score: 180 },
  { name: 'Charlie', score: 220 },
];

export default function ContestScoreboard() {
  const [data, setData] = useState([]);

  useEffect(() => {
    // Fetch scores from DB
    setData(scores);
  }, []);

  return (
    <div>
      <h2>Weekly Contest Scoreboard</h2>
      <table>
        <thead>
          <tr><th>Name</th><th>Score</th></tr>
        </thead>
        <tbody>
          {data.map((s, idx) => (
            <tr key={idx}><td>{s.name}</td><td>{s.score}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
