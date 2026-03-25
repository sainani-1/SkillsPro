export async function assignBalancedTeacherToStudent(supabase, studentId) {
  if (!supabase || !studentId) {
    throw new Error('Student id is required for teacher assignment.');
  }

  const { data: student, error: studentError } = await supabase
    .from('profiles')
    .select('id, role, assigned_teacher_id, deleted_at')
    .eq('id', studentId)
    .maybeSingle();

  if (studentError) throw studentError;
  if (!student) throw new Error('Student profile not found.');
  if (student.role !== 'student') {
    return { assignedTeacherId: null, teacher: null, reusedExisting: false };
  }
  if (student.deleted_at) {
    return { assignedTeacherId: null, teacher: null, reusedExisting: false };
  }

  const { data: teachers, error: teachersError } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, is_disabled, deleted_at')
    .eq('role', 'teacher')
    .is('deleted_at', null)
    .order('full_name', { ascending: true });

  if (teachersError) throw teachersError;

  const availableTeachers = (teachers || []).filter((teacher) => !teacher.is_disabled);
  if (!availableTeachers.length) {
    return { assignedTeacherId: null, teacher: null, reusedExisting: false };
  }

  const currentTeacher = availableTeachers.find((teacher) => String(teacher.id) === String(student.assigned_teacher_id || ''));
  if (currentTeacher) {
    return {
      assignedTeacherId: currentTeacher.id,
      teacher: currentTeacher,
      reusedExisting: true,
    };
  }

  const teacherIds = availableTeachers.map((teacher) => teacher.id);
  const { data: assignedStudents, error: assignedStudentsError } = await supabase
    .from('profiles')
    .select('id, assigned_teacher_id')
    .eq('role', 'student')
    .is('deleted_at', null)
    .in('assigned_teacher_id', teacherIds);

  if (assignedStudentsError) throw assignedStudentsError;

  const studentCountByTeacherId = new Map(teacherIds.map((teacherId) => [String(teacherId), 0]));
  (assignedStudents || []).forEach((assignedStudent) => {
    const teacherId = String(assignedStudent.assigned_teacher_id || '');
    if (!teacherId || String(assignedStudent.id) === String(student.id)) return;
    studentCountByTeacherId.set(teacherId, (studentCountByTeacherId.get(teacherId) || 0) + 1);
  });

  let minimumCount = Number.POSITIVE_INFINITY;
  availableTeachers.forEach((teacher) => {
    minimumCount = Math.min(minimumCount, studentCountByTeacherId.get(String(teacher.id)) || 0);
  });

  const leastLoadedTeachers = availableTeachers.filter(
    (teacher) => (studentCountByTeacherId.get(String(teacher.id)) || 0) === minimumCount
  );
  const selectedTeacher = leastLoadedTeachers[Math.floor(Math.random() * leastLoadedTeachers.length)] || null;

  if (!selectedTeacher) {
    return { assignedTeacherId: null, teacher: null, reusedExisting: false };
  }

  const { error: assignmentError } = await supabase
    .from('profiles')
    .update({ assigned_teacher_id: selectedTeacher.id })
    .eq('id', student.id);

  if (assignmentError) throw assignmentError;

  return {
    assignedTeacherId: selectedTeacher.id,
    teacher: selectedTeacher,
    reusedExisting: false,
  };
}
