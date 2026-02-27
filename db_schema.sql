-- StepWithNani core schema (ordered for FKs, no custom types)

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- Profiles
create table if not exists profiles (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  phone text,
  avatar_url text,
  role text not null default 'student', -- student|teacher|admin
  core_subject text,
  education_level text, -- B.Tech|12th|Intermediate|10th
  study_stream text, -- Computer Science|Mechanical|MPC|BIPC|MBPC for branches/streams
  diploma_certificate text, -- For 12th grade students - diploma/certificate details
  premium_until timestamptz,
  assigned_teacher_id uuid references profiles(id),
  is_locked boolean default false,
  locked_until timestamptz,
  is_disabled boolean default false,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    mfa_secret text
);

-- Courses
create table if not exists courses (
  id bigserial primary key,
  title text not null,
  description text,
  category text not null,
  thumbnail_url text,
  video_url text,
  notes_url text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists course_topics (
  id bigserial primary key,
  course_id bigint references courses(id) on delete cascade,
  title text not null,
  order_index int default 0
);

create table if not exists course_notes (
  id bigserial primary key,
  course_id bigint references courses(id) on delete cascade,
  topic_id bigint references course_topics(id) on delete set null,
  content text,
  order_index int default 0
);

-- Enrollments and progress
create table if not exists enrollments (
  id bigserial primary key,
  student_id uuid references profiles(id) on delete cascade,
  course_id bigint references courses(id) on delete cascade,
  progress numeric default 0,
  exam_score numeric,
  completed boolean default false,
  certificate_id uuid,
  enrolled_at timestamptz default now(),
  unique (student_id, course_id)
);

-- Payments and premium grants
create table if not exists payments (
  id bigserial primary key,
  user_id uuid references profiles(id) on delete cascade,
  amount numeric not null,
  currency text default 'INR',
  status text not null,
  valid_until timestamptz,
  gateway_ref text,
  created_at timestamptz default now()
);

create table if not exists premium_grants (
  id bigserial primary key,
  user_id uuid references profiles(id) on delete cascade,
  granted_by uuid references profiles(id),
  reason text,
  valid_until timestamptz,
  revoked_at timestamptz,
  created_at timestamptz default now()
);

-- Exams
create table if not exists exams (
  id bigserial primary key,
  course_id bigint references courses(id) on delete cascade,
  duration_minutes int default 100,
  pass_percent int default 70,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists exam_questions (
  id bigserial primary key,
  exam_id bigint references exams(id) on delete cascade,
  question text not null,
  options text[] not null,
  correct_index int not null,
  order_index int default 0
);

create table if not exists exam_submissions (
  id bigserial primary key,
  exam_id bigint references exams(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  score_percent numeric,
  passed boolean,
  started_at timestamptz default now(),
  submitted_at timestamptz,
  proctor_flags jsonb default '{}'::jsonb,
  attempt_number int default 1,
  next_attempt_allowed_at timestamptz,
  unique (exam_id, user_id)
);

-- Admin overrides for retake windows
create table if not exists exam_retake_overrides (
  id bigserial primary key,
  user_id uuid references profiles(id) on delete cascade,
  course_id bigint references courses(id) on delete cascade,
  allow_retake_at timestamptz,
  created_at timestamptz default now()
);

-- Global exam settings (single-row, default lock days)
create table if not exists exam_settings (
  id int primary key default 1,
  default_lock_days int default 60
);

insert into exam_settings (id, default_lock_days)
  values (1, 60)
  on conflict (id) do nothing;

-- Certificates and verification
create table if not exists certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  course_id bigint references courses(id) on delete cascade,
  exam_submission_id bigint references exam_submissions(id),
  issued_at timestamptz default now(),
  pdf_url text,
  revoked_at timestamptz
);

create table if not exists certificate_verifications (
  id bigserial primary key,
  certificate_id uuid references certificates(id) on delete cascade,
  verified_at timestamptz default now(),
  requester_ip inet
);

-- Career guidance
create table if not exists guidance_requests (
  id bigserial primary key,
  student_id uuid references profiles(id) on delete cascade,
  topic text,
  notes text,
  status text default 'pending', -- pending|assigned|scheduled|completed
  assigned_to_teacher_id uuid references profiles(id),
  created_at timestamptz default now(),
  assigned_at timestamptz
);

create table if not exists guidance_sessions (
  id bigserial primary key,
  request_id bigint references guidance_requests(id) on delete cascade,
  teacher_id uuid references profiles(id),
  scheduled_for timestamptz,
  join_link text,
  status text default 'scheduled', -- scheduled|completed
  reminder_sent_at timestamptz,
  created_at timestamptz default now()
);

-- Teacher assignments
create table if not exists teacher_assignments (
  id bigserial primary key,
  teacher_id uuid references profiles(id),
  student_id uuid references profiles(id),
  assigned_by uuid references profiles(id),
  assigned_at timestamptz default now(),
  active boolean default true,
  unique (teacher_id, student_id)
);

-- Live classes and attendance
create table if not exists class_sessions (
  id bigserial primary key,
  teacher_id uuid references profiles(id),
  title text,
  scheduled_for timestamptz,
  duration_minutes int default 60,
  join_link text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- Session reassignments (when teacher is on leave)
create table if not exists session_reassignments (
  id bigserial primary key,
  session_id bigint references class_sessions(id) on delete cascade,
  original_teacher_id uuid references profiles(id),
  reassigned_to_teacher_id uuid references profiles(id),
  leave_id bigint references teacher_leaves(id),
  reason text,
  reassigned_at timestamptz default now(),
  reverted_at timestamptz
);

create table if not exists class_attendance (
  id bigserial primary key,
  session_id bigint references class_sessions(id) on delete cascade,
  student_id uuid references profiles(id),
  teacher_id uuid references profiles(id),
  attended boolean,
  marked_at timestamptz default now(),
  unique (session_id, student_id)
);

-- Guidance attendance (separate from class attendance)
create table if not exists guidance_attendance (
  id bigserial primary key,
  session_id bigint references guidance_sessions(id) on delete cascade,
  student_id uuid references profiles(id),
  teacher_id uuid references profiles(id),
  attended boolean,
  marked_at timestamptz default now(),
  unique (session_id, student_id)
);

-- Leaves with comments and revoke
create table if not exists teacher_leaves (
  id bigserial primary key,
  teacher_id uuid references profiles(id),
  start_date date,
  end_date date,
  reason text,
  status text default 'pending',
  admin_comments text,
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  created_at timestamptz default now()
);

-- Compatibility view for legacy clients querying leave_requests
create or replace view leave_requests as
select
  id,
  teacher_id,
  start_date,
  end_date,
  reason,
  status,
  admin_comments,
  decided_by,
  decided_at,
  created_at
from teacher_leaves;

-- Chat (admin visible)
create table if not exists chat_groups (
  id bigserial primary key,
  name text,
  group_type text default 'student_teacher', -- student_teacher|group
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  is_admin_managed boolean default true
);

create table if not exists chat_members (
  id bigserial primary key,
  group_id bigint references chat_groups(id) on delete cascade,
  user_id uuid references profiles(id),
  role text default 'member',
  unique (group_id, user_id)
);

create table if not exists chat_messages (
  id bigserial primary key,
  group_id bigint references chat_groups(id) on delete cascade,
  sender_id uuid references profiles(id),
  content text,
  created_at timestamptz default now()
);

-- Admin-only requests before teacher assignment
create table if not exists admin_requests (
  id bigserial primary key,
  user_id uuid references profiles(id),
  type text,
  content text,
  status text default 'open',
  created_at timestamptz default now()
);

-- Renewal reminders
create table if not exists renewal_reminders (
  id bigserial primary key,
  user_id uuid references profiles(id),
  reminder_for timestamptz,
  sent_at timestamptz
);

-- Admin notifications
create table if not exists admin_notifications (
  id bigserial primary key,
  admin_id uuid references profiles(id),
  title text not null,
  content text not null,
  type text default 'info', -- info|warning|success
  target_role text default 'all', -- all|student|teacher
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists notification_reads (
  id bigserial primary key,
  notification_id bigint references admin_notifications(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  read_at timestamptz default now(),
  unique (notification_id, user_id)
);

-- Seed courses
insert into courses (title, category, description) values
  ('C Programming Fundamentals', 'Programming', 'Master the basics of C programming language'),
  ('Advanced Java Programming', 'Programming', 'Deep dive into Java enterprise development'),
  ('Python Data Science', 'Data Science', 'Learn data analysis and machine learning with Python'),
  ('JavaScript ES6+', 'Programming', 'Modern JavaScript features and best practices'),
  ('React JS Full Stack', 'Web Development', 'Build modern web apps with React'),
  ('Node.js Backend', 'Web Development', 'Server-side JavaScript with Node and Express'),
  ('Operating Systems Internals', 'Core CS', 'OS concepts, scheduling, memory management'),
  ('Database Management (DBMS)', 'Core CS', 'Relational databases, SQL, normalization'),
  ('Data Structures & Algorithms', 'Core CS', 'Essential DSA for coding interviews'),
  ('Computer Networks', 'Core CS', 'TCP/IP, protocols, network security'),
  ('R for Statistics', 'Data Science', 'Statistical computing and graphics with R'),
  ('Machine Learning Basics', 'Data Science', 'Intro to ML algorithms and models'),
  ('Deep Learning with TensorFlow', 'Data Science', 'Neural networks and deep learning'),
  ('SQL Mastery', 'Database', 'Advanced SQL queries and optimization'),
  ('MongoDB Essentials', 'Database', 'NoSQL database design and operations'),
  ('PostgreSQL Deep Dive', 'Database', 'Advanced PostgreSQL features'),
  ('Redis Caching', 'Database', 'In-memory data structure store'),
  ('Docker Containers', 'DevOps', 'Containerization with Docker'),
  ('Kubernetes Orchestration', 'DevOps', 'Container orchestration at scale'),
  ('CI/CD Pipelines', 'DevOps', 'Continuous integration and deployment'),
  ('Linux System Admin', 'DevOps', 'Linux server management'),
  ('Git Version Control', 'Tools', 'Master Git workflows and collaboration'),
  ('AWS Cloud Practitioner', 'Cloud', 'Amazon Web Services fundamentals'),
  ('Azure Fundamentals', 'Cloud', 'Microsoft Azure cloud platform'),
  ('Google Cloud Platform', 'Cloud', 'GCP services and architecture'),
  ('System Design Fundamentals', 'Core CS', 'Scalable system architecture'),
  ('Microservices Architecture', 'Web Development', 'Building distributed systems'),
  ('GraphQL API Design', 'Web Development', 'Modern API development'),
  ('TypeScript Essentials', 'Programming', 'Type-safe JavaScript development'),
  ('Go Programming', 'Programming', 'Golang for backend development'),
  ('Rust Programming', 'Programming', 'Systems programming with Rust'),
  ('Swift iOS Development', 'Mobile', 'Build iOS apps with Swift'),
  ('Kotlin Android Development', 'Mobile', 'Android app development'),
  ('Flutter Cross-Platform', 'Mobile', 'Build apps for iOS and Android'),
  ('React Native', 'Mobile', 'JavaScript mobile development'),
  ('Cybersecurity Basics', 'Security', 'Introduction to information security'),
  ('Ethical Hacking', 'Security', 'Penetration testing fundamentals'),
  ('Web Security', 'Security', 'Secure web application development'),
  ('Cryptography Fundamentals', 'Security', 'Encryption and secure communication'),
  ('Blockchain Basics', 'Emerging Tech', 'Distributed ledger technology'),
  ('Smart Contract Development', 'Emerging Tech', 'Ethereum and Solidity'),
  ('AI & Machine Learning', 'AI', 'Artificial intelligence fundamentals'),
  ('Natural Language Processing', 'AI', 'Text processing and understanding'),
  ('Computer Vision', 'AI', 'Image processing and recognition'),
  ('UI/UX Design Principles', 'Design', 'User interface and experience design'),
  ('Figma for Developers', 'Design', 'Design tool for product teams'),
  ('Tailwind CSS', 'Web Development', 'Utility-first CSS framework'),
  ('Bootstrap 5', 'Web Development', 'Responsive web design framework'),
  ('Vue.js Framework', 'Web Development', 'Progressive JavaScript framework'),
  ('Angular Framework', 'Web Development', 'Enterprise web applications'),
  ('Django Web Framework', 'Web Development', 'Python web development'),
  ('Ruby on Rails', 'Web Development', 'Full-stack web development'),
  ('PHP Laravel', 'Web Development', 'Modern PHP framework')
  on conflict do nothing;

-- RLS Policies for Chat Tables
ALTER TABLE chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Chat groups: users can see groups they're members of
DROP POLICY IF EXISTS "users_select_own_chat_groups" ON chat_groups;
CREATE POLICY "users_select_own_chat_groups" ON chat_groups
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_members 
      WHERE chat_members.group_id = chat_groups.id 
      AND chat_members.user_id = auth.uid()
    )
  );

-- Chat members: users can see members of their groups
DROP POLICY IF EXISTS "users_select_chat_members" ON chat_members;
CREATE POLICY "users_select_chat_members" ON chat_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_members AS cm
      WHERE cm.group_id = chat_members.group_id 
      AND cm.user_id = auth.uid()
    )
  );

-- Chat members: insert own membership
DROP POLICY IF EXISTS "users_insert_chat_members" ON chat_members;
CREATE POLICY "users_insert_chat_members" ON chat_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Chat messages: users can see messages from their groups
DROP POLICY IF EXISTS "users_select_chat_messages" ON chat_messages;
CREATE POLICY "users_select_chat_messages" ON chat_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_members 
      WHERE chat_members.group_id = chat_messages.group_id 
      AND chat_members.user_id = auth.uid()
    )
  );

-- Chat messages: users can send messages to their groups
DROP POLICY IF EXISTS "users_insert_chat_messages" ON chat_messages;
CREATE POLICY "users_insert_chat_messages" ON chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM chat_members 
      WHERE chat_members.group_id = chat_messages.group_id 
      AND chat_members.user_id = auth.uid()
    )
  );
