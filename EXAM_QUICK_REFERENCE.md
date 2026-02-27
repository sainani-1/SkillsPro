# 📋 Exam System - Quick Reference Guide

## User Flows at a Glance

### ✅ Student Passes Exam (70%+ score)
| Step | What Happens | UI Display |
|------|-------------|-----------|
| 1. Complete exam | Score calculated | "Congratulations! 85%!" |
| 2. Result saved | `passed=true` | Redirects to dashboard |
| 3. Certificate created | Auto-generated | Appears in "My Certificates" |
| 4. View course | Exam status | "✓ Exam Passed" badge |
| 5. Try to reopen | Blocked | "Exam Completed" screen |
| 6. View certificate | Link available | Download PDF option |

### ❌ Student Fails Exam (<70% score)
| Step | What Happens | UI Display |
|------|-------------|-----------|
| 1. Complete exam | Score calculated | "You scored 45.2%... try in 60 days" |
| 2. Result saved | `passed=false` `next_attempt_allowed_at=NOW+60d` | Redirects to courses |
| 3. View course (day 30) | Cooldown active | "⚠ Score: 45.2%" + "30d left" |
| 4. View course (day 59) | Still cooling down | "⚠ Score: 45.2%" + "1d left" |
| 5. View course (day 60+) | Cooldown expired | "Retry" button appears |
| 6. Click "Retry" | Can take exam again | Opens exam normally |
| 7. Second attempt | attempt_number=2 | Same process repeats |

---

## Button States by Exam Status

```
STATUS          DASHBOARD BUTTON    COURSELIST BUTTON    CLICKABLE?
─────────────────────────────────────────────────────────────────
Not Taken       "Resume"           "Exam"               ✅ YES
Passed          "View Cert"        "Passed"             ❌ NO
Failed <60d     "Xd left"          "Xd wait"            ❌ NO
Failed ≥60d     "Retry"            "Retry"              ✅ YES
```

---

## Database Fields

### exam_submissions Table
```javascript
{
  exam_id,              // Foreign key to exams
  user_id,              // Foreign key to profiles
  score_percent,        // 0-100
  passed,               // true/false
  started_at,           // ISO timestamp
  submitted_at,         // ISO timestamp
  attempt_number,       // 1, 2, 3... (NEW)
  next_attempt_allowed_at  // ISO timestamp or null (NEW)
}
```

---

## Key Calculations

### Days Until Retry
```javascript
const daysLeft = Math.ceil(
  (new Date(next_attempt_allowed_at) - new Date()) 
  / (1000 * 60 * 60 * 24)
);
// Returns: Number of full days remaining
```

### Retry Eligibility
```javascript
const canRetry = !next_attempt_allowed_at || 
                 new Date(next_attempt_allowed_at) <= new Date();
// Returns: true if can take exam, false if in cooldown
```

---

## Configuration Quick-Access

**File: [src/pages/Exam.jsx](src/pages/Exam.jsx)**

| Setting | Line | Current Value | How to Change |
|---------|------|---------------|---------------|
| Pass threshold | 157 | 70% | Change `>= 70` |
| Cooldown period | 150 | 60 days | Change `+ 60` to `+ X` |
| Total questions | 69 | 25 | Change array length |
| Time limit | 22 | 100 min | Change `100 * 60` |
| Warning limit | 116 | 3 warnings | Change `>= 3` |

---

## Common Scenarios & Solutions

### Scenario: Student says "I passed but can't see certificate"
**Check:**
1. Verify in "My Certificates" tab
2. Check `certificates` table for `user_id` and `course_id`
3. Ensure `revoked_at IS NULL`

### Scenario: Student says "Can't retake after 60 days"
**Check:**
1. Verify `next_attempt_allowed_at` is in the past
2. Refresh page (may be cached)
3. Check `exam_submissions.passed=false`

### Scenario: "Attempt number isn't incrementing"
**Check:**
1. Verify `exam_submissions` table has `attempt_number` column
2. Check latest submission's `attempt_number` value
3. Ensure submission is INSERT (not just UPDATE)

---

## Testing Quick Commands

**Test Passing:**
1. Open exam, answer 18+ of 25 correctly (≥70%)
2. Submit
3. Should see congratulations message
4. Check dashboard → "✓ Exam Passed"
5. Try to reopen → "Exam Completed" screen

**Test Failing:**
1. Open exam, answer <18 of 25 correctly (<70%)
2. Submit
3. Should see "try again in 60 days" message
4. Check dashboard → "⚠ Score: X%" + "60d left"
5. Manual test: Update `next_attempt_allowed_at` to yesterday
6. Refresh page → "Retry" button should appear

**Test Certificate:**
1. Pass an exam
2. Go to [/app/mycertificates](/app/mycertificates)
3. Should see certificate card with course title and score

---

## API Calls (Supabase)

### Check if exam passed
```javascript
const { data } = await supabase
  .from('exam_submissions')
  .select('passed')
  .eq('exam_id', examId)
  .eq('user_id', userId)
  .single();

if (data?.passed) {
  // Exam already passed - show completion screen
}
```

### Get days until retry
```javascript
const { data } = await supabase
  .from('exam_submissions')
  .select('next_attempt_allowed_at')
  .eq('exam_id', examId)
  .eq('user_id', userId)
  .single();

const now = new Date();
const nextAttempt = new Date(data.next_attempt_allowed_at);
const daysLeft = Math.ceil((nextAttempt - now) / (1000*60*60*24));
```

### Create certificate
```javascript
await supabase.from('certificates').insert({
  user_id: userId,
  course_id: courseId,
  exam_submission_id: submissionId
});
```

---

## File Changes Summary

| File | Changes | Lines |
|------|---------|-------|
| [db_schema.sql](db_schema.sql) | +2 columns to exam_submissions | +2 |
| [src/pages/Exam.jsx](src/pages/Exam.jsx) | Check exam status, show blocked screens, set retry dates | +130 |
| [src/pages/StudentDashboard.jsx](src/pages/StudentDashboard.jsx) | Fetch exam results, show status & countdown | +80 |
| [src/pages/CourseList.jsx](src/pages/CourseList.jsx) | Fetch exam status, dynamic buttons | +60 |
| [src/pages/MyCertificates.jsx](src/pages/MyCertificates.jsx) | No changes (already works) | 0 |

---

## Status Badges Legend

```
✓ Exam Passed     = Green badge, exam locked, certificate available
⚠ Score: X%       = Orange text, shows actual percentage
Xd left           = Orange countdown, exam blocked
Passed            = Green badge (disabled), no click
Xd wait           = Orange badge (disabled), no click
Retry             = Blue badge (clickable), allows retake
Resume            = Default state, exam not attempted yet
View Cert         = Green link, opens certificates page
```

---

## Troubleshooting Matrix

| Problem | Check | Fix |
|---------|-------|-----|
| Button shows wrong state | Browser cache | Hard refresh (Ctrl+Shift+R) |
| Countdown not updating | Component not re-rendering | Check useEffect dependencies |
| Certificate missing | Database query | Check certificates table filters |
| Can't retry after 60 days | Timestamp comparison | Verify browser timezone matches server |
| Passed exam still shows exam button | State not updated | Refresh page or clear localStorage |
| Score percentage missing | Submission incomplete | Check submitted_at field |

---

## Data Retention

- **exam_submissions:** Kept indefinitely (audit trail)
- **certificates:** Kept unless `revoked_at` is set
- **attempt_number:** Incremented each submission
- **next_attempt_allowed_at:** NULL for passed exams, 60 days ahead for failed

---

## Performance Notes

- Exam status check on mount: Single query (fast)
- Dashboard exam results: N queries for N courses (consider batching)
- CourseList exam results: N queries (runs on mount, ok for <50 courses)
- Index recommendation: `CREATE INDEX idx_exam_submissions_user_course ON exam_submissions(user_id, exam_id)`

