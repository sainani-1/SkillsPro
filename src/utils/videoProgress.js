export const buildVideoProgressKey = (userId, courseId) => `course_video_progress_${userId || 'guest'}_${courseId}`;

export const readVideoProgress = (userId, courseId) => {
  if (typeof window === 'undefined' || !courseId) return null;
  try {
    const raw = window.localStorage.getItem(buildVideoProgressKey(userId, courseId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.currentTime !== 'number' && typeof parsed.duration !== 'number') return null;
    return parsed;
  } catch (error) {
    return null;
  }
};

export const writeVideoProgress = (userId, courseId, payload) => {
  if (typeof window === 'undefined' || !courseId) return;
  try {
    window.localStorage.setItem(buildVideoProgressKey(userId, courseId), JSON.stringify(payload));
  } catch (error) {
    // Ignore storage failures.
  }
};

export const getVideoCompletionPercent = (progress) => {
  if (!progress) return 0;
  if (progress.completed) return 100;
  const duration = Number(progress.duration) || 0;
  const currentTime = Math.max(0, Number(progress.currentTime) || 0);
  if (duration <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((currentTime / duration) * 100)));
};

export const formatVideoResumeLabel = (seconds) => {
  const totalSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
  return `${remainingSeconds}s`;
};
