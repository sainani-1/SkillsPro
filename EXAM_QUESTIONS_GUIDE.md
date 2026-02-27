# Exam Questions Manager - Setup Guide ✅

## How to Add Exam Questions to Your Courses

### Step 1: Go to Courses Page (Admin Only)
1. Log in as an Admin
2. Navigate to **Courses** page
3. You'll see all courses in a grid layout

### Step 2: Access Exam Questions Manager
1. **Hover over any course card** - You'll see three buttons appear in the top-left:
   - Blue button = Edit course
   - **Purple button = Manage exam questions** ← Click this
   - Red button = Delete course

2. Click the **purple button** (FileText icon) to open the Exam Questions Manager

### Step 3: Add Questions
Inside the modal, you'll see:
- **Current Questions List** - Shows all questions already added (if any)
- **Add New Question Form** below

#### To Add a Question:
1. **Enter the question text** in the textarea
   - Example: "What is the capital of France?"

2. **Fill in all 4 options** (A, B, C, D)
   - Option A field
   - Option B field
   - Option C field
   - Option D field

3. **Mark the correct answer** by clicking the letter button
   - Click **A**, **B**, **C**, or **D** button to mark which option is correct
   - The button will turn green when selected
   - Example: If "Paris" is in Option B, click the **B** button

4. **Click "Add Question"** button to save

### Step 4: Verify Questions Were Added
- You'll see a success message
- The question appears in the list above
- Questions show all options with the correct answer marked with a ✓ symbol

### Example Question Setup

**Question:** What is 2 + 2?

**Options:**
- A) 3
- B) 4 ← Mark as correct (click B button)
- C) 5
- D) 6

**Result:** The exam will show all 4 options, and B will be marked as the correct answer internally.

## Tips

### Adding Multiple Questions
- You can add as many questions as you want
- Click "Add Question" after each one
- The order will be automatically managed

### Question Types Supported
- Single-answer multiple choice (4 options per question)
- One correct answer per question
- Questions display in the order they were added

### Editing Questions
Currently, you can:
- Delete a question (click trash icon on the question card)
- Add new questions

To change a question, delete it and add a new one.

## Exam Settings

Each course automatically gets an exam with:
- **Duration:** 60 minutes (default)
- **Pass Percentage:** 70% required to pass
- **Questions:** As many as you add!

### How Scoring Works
- Each question = 1 point
- If you add 25 questions, total is 25 points
- Students need 70% to pass
- Example: 25 questions × 70% = 17.5 (need ~18 questions correct)

## What Students See

When students take the exam:
1. They see the exam timer
2. They must allow camera access (proctoring)
3. They answer all questions you added
4. System automatically grades based on correct answers
5. Pass/Fail result is shown
6. Certificate generated if passed

## Testing Your Exam

1. **As a student**, enroll in the course
2. Click "Take Exam" button
3. Complete the exam to test it
4. Verify your setup is working

## Common Issues & Solutions

### "No questions found, using sample questions"
**Cause:** No exam questions were added to the course
**Solution:** Use this guide to add questions via the purple button

### Students see 25 sample questions
**Cause:** The exam exists but has no real questions yet
**Solution:** Add at least one question using the manager

### Question not saving
**Cause:** Required field is empty
**Solution:** Make sure:
- Question text is not empty
- All 4 option fields have text
- A correct answer is selected (button should be green)

## Database Schema

Your exam questions are stored in the `exam_questions` table with:
- `id` - Unique question ID
- `exam_id` - Links to the exam for the course
- `question` - The question text
- `options` - Array of 4 answer options [A, B, C, D]
- `correct_index` - 0, 1, 2, or 3 (which option is correct)
- `order_index` - Question number in the exam

## Next Steps

1. ✅ Add exam questions to your courses
2. ✅ Test by taking an exam as a student
3. ✅ Verify video, notes, and exam all work
4. ✅ Students can now enroll → watch video → download notes → take exam → get certificate
