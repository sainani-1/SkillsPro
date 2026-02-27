# StepWithNani Exam System Documentation

## Overview
The exam system manages exam completions, certificate generation, and retry logic with a 60-day cooldown period for failed attempts.

## Database Schema Updates

### exam_submissions Table
Enhanced with new fields to track multiple attempts and retry eligibility:

```sql
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
```

**New Fields:**
- `attempt_number`: Tracks which attempt (1st, 2nd, 3rd, etc.)
- `next_attempt_allowed_at`: Timestamp when student can retry (60 days after failure)

## User Flows

### Flow 1: Exam Passed (70%+ score)
```
1. Student takes exam
2. Student scores ≥70%
3. Exam.jsx:
   - Sets passed=true
   - Creates certificate record
   - Shows "Congratulations" message with score
   - Redirects to /app/dashboard
4. Certificate immediately available in "My Certificates" tab
5. Exam button shows "Passed" badge and disables retake
6. On next attempt to open exam:
   - Shows "Exam Completed" screen
   - Provides "View Certificate" button
   - Prevents exam reopening
```

**Student Dashboard View:**
- Course shows with "✓ Exam Passed" status
- Exam button shows green "View Cert" link
- Certificate count increments

**Course List View:**
- Exam button shows "Passed" badge (green)
- Button is disabled (not clickable)

---

### Flow 2: Exam Failed (< 70% score)
```
1. Student takes exam
2. Student scores <70%
3. Exam.jsx:
   - Sets passed=false
   - Calculates next_attempt_allowed_at = NOW + 60 days
   - Stores attempt_number
   - Shows "You failed, try again in 60 days" message
   - Redirects to /app/courses
4. Next 60 days:
   - Student sees "Try Again in X days" on dashboard/course list
   - Exam button disabled showing days remaining
5. After 60 days:
   - Button changes to "Retry" (blue)
   - Student can retake exam
   - Attempt counter increments
```

**Student Dashboard View (within 60 days):**
- Course shows with score: "⚠ Score: 45.2%"
- Shows orange badge: "60d left"
- Exam button disabled

**Student Dashboard View (after 60 days):**
- Course shows with same score
- No countdown badge
- Exam button shows "Retry" link (clickable)

**Course List View:**
- Exam button shows "X days wait" (orange)
- Button is disabled during cooldown
- Changes to "Retry" button after 60 days

---

### Flow 3: Prevent Reopening Passed Exams
When exam is already passed, Exam.jsx checks on mount:
```javascript
// In useEffect
const { data: submission } = await supabase
  .from('exam_submissions')
  .select('id, passed, next_attempt_allowed_at')
  .eq('exam_id', exam.id)
  .eq('user_id', profile.id)
  .single();

if (submission?.passed) {
  setExamStatus('passed');
  // Fetch certificate ID
  // Show completion screen instead of exam
}
```

Shows special "Exam Completed" screen:
- Green checkmark icon
- "You have already passed this exam. You cannot retake it."
- "View Certificate" button → /app/mycertificates
- "Back to Courses" button

---

## Component Implementation Details

### Exam.jsx Changes
**New State Variables:**
```javascript
const [examStatus, setExamStatus] = useState(null); // 'passed', 'failed', 'can_retry', 'cannot_retry'
const [daysLeft, setDaysLeft] = useState(0);
const [certificateId, setCertificateId] = useState(null);
```

**On Mount Check:**
- Verifies if exam already passed
- Checks retry eligibility and days remaining
- Prevents exam opening if already passed

**Submit Logic:**
```javascript
// On failure
const nextAttemptDate = new Date();
nextAttemptDate.setDate(nextAttemptDate.getDate() + 60);

await supabase.from('exam_submissions').upsert({
  exam_id: exam.id,
  user_id: profile.id,
  score_percent: scorePercent,
  passed: false,
  submitted_at: new Date().toISOString(),
  attempt_number: attemptNumber,
  next_attempt_allowed_at: nextAttemptDate.toISOString()
});
```

**UI Screens:**
1. **Passed:** Green screen with certificate button
2. **Cannot Retry Yet:** Orange screen showing countdown
3. **Can Retry:** Normal exam permission screen

### StudentDashboard.jsx Changes
**New Features:**
- Fetches exam submissions for all courses
- Shows exam status next to each course
- Displays "✓ Exam Passed", "⚠ Score: X%", or "Exam pending"
- Shows retry countdown in days
- Provides quick action buttons:
  - "View Cert" → /app/mycertificates
  - "X days left" → countdown display
  - "Retry" → /exam/courseId
  - "Resume" → /exam/courseId (if not attempted yet)

**Exam Progress Widget:**
Shows summary cards:
- Passed: Count of certificates
- In Progress: Courses without passed exams

### CourseList.jsx Changes
**New Features:**
- Fetches exam results on component mount (premium users only)
- `getExamButton()` function returns appropriate button:
  - **Untaken:** "Exam" button (orange) → opens exam
  - **Passed:** "Passed" badge (green, disabled)
  - **Failed <60 days:** "X days wait" (orange, disabled)
  - **Failed ≥60 days:** "Retry" button (blue) → opens exam

### MyCertificates.jsx
Already displays certificates earned. Now receives students from:
1. Dashboard completion
2. Exam.jsx certificate creation
3. Shows Award icon, course title, issue date, score

---

## Time Calculation Helper
```javascript
const getDaysUntilRetry = (nextAttemptDate) => {
  if (!nextAttemptDate) return 0;
  const next = new Date(nextAttemptDate);
  const now = new Date();
  const diff = next - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};
```
Returns: Number of full days remaining (rounds up for partial days)

---

## Certificate Flow
1. **Generation:** Automatic when exam passed (70%+)
2. **Storage:** certificates table records:
   - user_id: Student ID
   - course_id: Course ID
   - exam_submission_id: Link to exam result
   - issued_at: Timestamp
3. **Display:** MyCertificates page shows all active certificates
4. **Verification:** VerifyCertificate page allows public verification by certificate ID

---

## Database Migration Commands
Run in Supabase SQL Editor to implement these changes:

```sql
-- Add new columns to exam_submissions
ALTER TABLE exam_submissions 
ADD COLUMN attempt_number int DEFAULT 1;

ALTER TABLE exam_submissions 
ADD COLUMN next_attempt_allowed_at timestamptz;

-- Drop and recreate unique constraint to allow multiple submissions
ALTER TABLE exam_submissions 
DROP CONSTRAINT exam_submissions_exam_id_user_id_key;

ALTER TABLE exam_submissions 
ADD UNIQUE (exam_id, user_id);

-- Create index for faster lookups
CREATE INDEX idx_exam_submissions_user_next_attempt 
ON exam_submissions(user_id, next_attempt_allowed_at);
```

---

## Testing Scenarios

### Test 1: Passing Exam
```
1. Open any exam
2. Answer 18+ questions correctly (70%+ = pass)
3. Submit
4. Should see "Congratulations!" message
5. Go to Dashboard → course should show "✓ Exam Passed"
6. Go to Course List → exam button should show "Passed" (disabled)
7. Go to My Certificates → certificate should appear
8. Try to open exam again → should see "Exam Completed" screen
```

### Test 2: Failing Exam
```
1. Open any exam
2. Answer <18 questions correctly (<70% = fail)
3. Submit
4. Should see "You failed, try again in 60 days" message
5. Go to Dashboard → course should show "⚠ Score: X%"
6. Dashboard should show "60d left"
7. Go to Course List → exam button should show "60d wait" (disabled)
```

### Test 3: Retry After 60 Days
```
1. Find exam record in database
2. Manually set next_attempt_allowed_at to yesterday
3. Refresh Course List → should show "Retry" button
4. Click "Retry" → should open exam normally
5. After retake, attempt_number should be 2
```

---

## Configuration
- **Pass threshold:** 70% (configurable in Exam.jsx: `const passed = scorePercent >= 70;`)
- **Cooldown period:** 60 days (configurable in submitExam: `setDate(getDate() + 60)`)
- **Total questions:** 25 (configurable in questions array)
- **Exam duration:** 100 minutes (configurable in state initialization)

---

## Error Handling
- **Exam fetch failure:** Silent fail, user sees normal exam screen
- **Submission failure:** Shows alert, user can retry
- **Certificate generation:** Automatic, no user feedback needed
- **Database connectivity:** Supabase handles with built-in retry logic

---

## Future Enhancements
1. **Email Notifications:**
   - Congratulation email when exam passed
   - Countdown reminder 7 days before retry allowed
2. **Multiple Certificates:**
   - Allow retaking passed exams for score improvement
   - Display best score on certificate
3. **Analytics:**
   - Track average attempt count
   - Identify difficult sections
   - Suggest review materials
4. **Adaptive Testing:**
   - Adjust question difficulty based on answers
   - Personalized practice questions
5. **Time Tracking:**
   - Show average time per question
   - Highlight time-consuming sections
