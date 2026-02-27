-- Add missing columns to courses table
-- This migration adds support for notes URLs and ensures all course fields exist

ALTER TABLE courses ADD COLUMN IF NOT EXISTS notes_url TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add description if missing
ALTER TABLE courses ADD COLUMN IF NOT EXISTS description TEXT;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category);
CREATE INDEX IF NOT EXISTS idx_courses_is_active ON courses(is_active);
