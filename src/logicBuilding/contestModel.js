// Weekly contest model
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
// Stores contest info, questions, and schedule
export const weeklyContest = {
  day: 'Monday',
  startTime: '20:00',
  endTime: '22:00',
  questions: [],
  async load() {
    const docRef = doc(db, 'logicBuilding', 'weeklyContest');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      this.day = data.day;
      this.startTime = data.startTime;
      this.endTime = data.endTime;
      this.questions = data.questions || [];
    }
  },
  async save() {
    const docRef = doc(db, 'logicBuilding', 'weeklyContest');
    await setDoc(docRef, {
      day: this.day,
      startTime: this.startTime,
      endTime: this.endTime,
      questions: this.questions,
    });
  },
  subscribe(callback) {
    const docRef = doc(db, 'logicBuilding', 'weeklyContest');
    return onSnapshot(docRef, snap => {
      if (snap.exists()) {
        const data = snap.data();
        this.day = data.day;
        this.startTime = data.startTime;
        this.endTime = data.endTime;
        this.questions = data.questions || [];
        callback();
      }
    });
  },
  setSchedule(day, startTime, endTime) {
    this.day = day;
    this.startTime = startTime;
    this.endTime = endTime;
  },
  setQuestions(questions) {
    this.questions = questions;
  },
};


export async function isContestActive() {
  // Get server time from Firestore
  const serverTimeDoc = doc(db, 'logicBuilding', 'serverTime');
  let serverDate = null;
  try {
    await setDoc(serverTimeDoc, { ts: serverTimestamp() });
    const snap = await getDoc(serverTimeDoc);
    if (snap.exists() && snap.data().ts) {
      serverDate = snap.data().ts.toDate();
    }
  } catch (e) {
    // fallback to client time if server time fails
    serverDate = new Date();
  }
  const date = serverDate || new Date();
  const day = date.toLocaleString('en-US', { weekday: 'long' });
  const [startHour, startMin] = weeklyContest.startTime.split(':').map(Number);
  const [endHour, endMin] = weeklyContest.endTime.split(':').map(Number);
  const nowHour = date.getHours();
  const nowMin = date.getMinutes();
  const shouldLog = import.meta.env.DEV && import.meta.env.VITE_LOGIC_BUILDING_DEBUG === 'true';
  if (shouldLog) {
    console.log('[LogicBuilding] Server time:', date.toString());
    console.log('[LogicBuilding] Server day:', day, '| Contest day:', weeklyContest.day);
    console.log('[LogicBuilding] Server hour:min:', nowHour + ':' + nowMin, '| Contest window:', weeklyContest.startTime, '-', weeklyContest.endTime);
  }
  // Handle contest windows that may cross midnight
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  const nowMinutes = nowHour * 60 + nowMin;
  let inWindow = false;
  if (endMinutes > startMinutes) {
    // Normal case: e.g., 20:00-22:00
    inWindow = nowMinutes >= startMinutes && nowMinutes <= endMinutes;
  } else {
    // Crosses midnight: e.g., 23:00-01:00
    inWindow = nowMinutes >= startMinutes || nowMinutes <= endMinutes;
  }
  if (shouldLog) {
    console.log('[LogicBuilding] In window:', inWindow);
  }
  if (day !== weeklyContest.day) return false;
  return inWindow;
}

export function getContestQuestions() {
  return weeklyContest.questions;
}

export function setContestQuestions(questions) {
  weeklyContest.setQuestions(questions);
}
