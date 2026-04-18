export const TEACHING_ROLES = ['teacher', 'mentor'];

export const isTeachingRole = (role) => TEACHING_ROLES.includes(String(role || '').toLowerCase());
