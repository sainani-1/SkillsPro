-- Migration: Add is_disabled column to profiles table
-- Purpose: Enable admin to temporarily disable user accounts without deletion

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_disabled boolean default false;

-- Add comment
COMMENT ON COLUMN profiles.is_disabled IS 'When true, user cannot login. Can be re-enabled by admin.';
