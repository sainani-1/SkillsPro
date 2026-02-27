-- Migration: Add locked_until column to profiles table
-- Run this in Supabase SQL Editor if the column doesn't exist

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS locked_until timestamptz;

-- This allows tracking when a 60-day lock expires
-- When a user violates exam proctoring, is_locked=true and locked_until=now()+60 days
-- Users are automatically unlocked when locked_until date passes
