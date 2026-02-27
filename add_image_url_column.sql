-- Add image_url column to courses table
-- This allows admins to add course images in addition to thumbnails

ALTER TABLE courses ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Optional: You can also rename thumbnail_url to image_url if you want consistency
-- ALTER TABLE courses RENAME COLUMN thumbnail_url TO image_url;

-- Update existing records to use thumbnail_url as image_url if needed
-- UPDATE courses SET image_url = thumbnail_url WHERE image_url IS NULL AND thumbnail_url IS NOT NULL;
