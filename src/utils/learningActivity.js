import { supabase } from '../supabaseClient';

export const BADGE_LEVELS = [
  { points: 1000, key: 'gold', label: 'Gold Badge', tone: 'from-amber-300 via-yellow-300 to-amber-500' },
  { points: 500, key: 'silver', label: 'Silver Badge', tone: 'from-slate-200 via-slate-100 to-slate-400' },
  { points: 100, key: 'bronze', label: 'Bronze Badge', tone: 'from-orange-300 via-amber-200 to-orange-500' },
];

export function getBadgeForPoints(points = 0) {
  return BADGE_LEVELS.find((badge) => points >= badge.points) || null;
}

export function getNextBadge(points = 0) {
  return [...BADGE_LEVELS].reverse().find((badge) => points < badge.points) || null;
}

function toDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function computeCurrentStreak(values = []) {
  const keys = [...new Set(values.map(toDateKey).filter(Boolean))].sort();
  if (keys.length === 0) return 0;

  const today = toDateKey(new Date());
  const yesterday = toDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const latest = keys[keys.length - 1];

  if (latest !== today && latest !== yesterday) {
    return 0;
  }

  let streak = 0;
  let cursor = new Date(`${latest}T00:00:00.000Z`);
  const lookup = new Set(keys);

  while (lookup.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }

  return streak;
}

export async function trackLearningActivity({
  userId,
  eventType,
  pointsAwarded = 0,
  durationMinutes = 0,
  metadata = {},
}) {
  if (!userId || !eventType) return;

  const payload = {
    user_id: userId,
    event_type: eventType,
    points_awarded: pointsAwarded,
    duration_minutes: durationMinutes,
    metadata,
    occurred_on: new Date().toISOString().slice(0, 10),
  };

  const { error } = await supabase.from('learning_activity_events').insert(payload);
  if (error) {
    throw error;
  }
}
