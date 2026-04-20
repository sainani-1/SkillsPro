import { supabase } from '../supabaseClient';
import { sendAdminNotification } from './adminNotifications';
import { getPremiumPlanType } from './premium';

export const RESUME_REVIEW_LIMIT = 2;
export const MOCK_INTERVIEW_LIMIT = 1;

export const getCareerCycleMonth = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const formatCareerCycle = (cycleMonth = getCareerCycleMonth()) => {
  const [year, month] = String(cycleMonth).split('-').map(Number);
  return new Date(year, (month || 1) - 1, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
};

export const isCareerStaff = (profile) => ['admin', 'teacher'].includes(String(profile?.role || '').toLowerCase());

export const canUseCareerSupport = (profile) => isCareerStaff(profile) || getPremiumPlanType(profile) === 'premium_plus';

export const readBuilderResume = (profile, user) => {
  if (typeof window === 'undefined') return null;
  const storageKey = `resume_builder_${profile?.id || user?.id || 'guest'}`;
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || 'null');
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

export const generateRoadmapPlan = (profile, context = {}) => {
  const targetRole = context.targetRole || profile?.core_subject || 'your target role';
  const weakAreas = context.weakAreas ? ` Give extra attention to ${context.weakAreas}.` : '';
  const cycleLabel = formatCareerCycle(context.cycleMonth);
  return {
    title: `${cycleLabel} Personal Roadmap`,
    summary: `Focus this month on strengthening ${targetRole}, improving interview readiness, and completing visible proof of work.${weakAreas}`,
    goals: [
      {
        title: 'Skill Focus',
        detail: `Spend focused practice time on ${targetRole}. Revise fundamentals, complete one advanced topic, and document what you learned.`,
      },
      {
        title: 'Project Proof',
        detail: 'Build or improve one portfolio project with a clear README, screenshots, and measurable outcomes.',
      },
      {
        title: 'Interview Practice',
        detail: 'Prepare a short introduction, 5 project explanations, 10 technical answers, and one mock interview reflection.',
      },
      {
        title: 'Resume Improvement',
        detail: 'Update your resume with stronger action verbs, quantified impact, project links, and clean formatting.',
      },
    ],
    weeklyTasks: [
      'Week 1: Audit current skill gaps and update your resume baseline.',
      'Week 2: Complete one project improvement and record what changed.',
      'Week 3: Practice interview answers and solve role-specific questions.',
      'Week 4: Review progress with your teacher and finalize next month priorities.',
    ],
  };
};

export const scoreResume = (resume = {}) => {
  const checks = [
    ['Professional summary', resume.summary && String(resume.summary).length >= 80, 15],
    ['Core skills', resume.skills && String(resume.skills).split(',').filter(Boolean).length >= 6, 15],
    ['Contact details', resume.email && resume.phone && resume.location, 10],
    ['LinkedIn or portfolio', resume.linkedin || resume.portfolio, 10],
    ['Experience details', resume.experience1Title && resume.experience1Description && String(resume.experience1Description).length >= 80, 15],
    ['Project proof', resume.project1Title && resume.project1Description && String(resume.project1Description).length >= 80, 15],
    ['Education', resume.education && String(resume.education).length >= 20, 10],
    ['Achievements', resume.achievements && String(resume.achievements).length >= 20, 10],
  ];
  const score = checks.reduce((total, [, passed, points]) => total + (passed ? points : 0), 0);
  return {
    score,
    missing: checks.filter(([, passed]) => !passed).map(([label]) => label),
    strengths: checks.filter(([, passed]) => passed).map(([label]) => label),
  };
};

export async function notifyCareerTeacher({ teacherId, title, message, source = 'career_support' }) {
  if (!teacherId) return;
  await sendAdminNotification({
    target_user_id: teacherId,
    target_role: 'teacher',
    title,
    content: message,
    type: source,
    created_at: new Date().toISOString(),
  });
}
