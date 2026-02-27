-- ================================================================
-- FIX INFINITE RECURSION IN CHAT RLS POLICIES
-- ================================================================
-- Run this ENTIRE script in Supabase SQL Editor
-- Copy ALL of it and run at once
-- ================================================================

-- STEP 1: Temporarily DISABLE RLS to clean up
ALTER TABLE chat_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;

-- STEP 2: Drop ALL existing policies (with disabled RLS, this won't fail)
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  -- Drop all policies on chat_groups
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'chat_groups') LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON chat_groups';
  END LOOP;
  
  -- Drop all policies on chat_members
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'chat_members') LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON chat_members';
  END LOOP;
  
  -- Drop all policies on chat_messages
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'chat_messages') LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON chat_messages';
  END LOOP;
END $$;

-- STEP 2: Add missing columns
ALTER TABLE chat_groups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE chat_groups ADD COLUMN IF NOT EXISTS name TEXT;

-- STEP 3: Create NEW policies without circular references

-- ============================================================
-- chat_members: MOST PERMISSIVE (NO checks on chat_groups)
-- ============================================================
CREATE POLICY "chat_members_select" ON chat_members
  FOR SELECT USING (true);

CREATE POLICY "chat_members_insert" ON chat_members
  FOR INSERT WITH CHECK (true);

CREATE POLICY "chat_members_update" ON chat_members
  FOR UPDATE USING (true);

CREATE POLICY "chat_members_delete" ON chat_members
  FOR DELETE USING (true);

-- ============================================================
-- chat_groups: Check only chat_members (one-way reference)
-- ============================================================
CREATE POLICY "chat_groups_select" ON chat_groups
  FOR SELECT USING (
    chat_groups.created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM chat_members 
      WHERE chat_members.group_id = chat_groups.id 
      AND chat_members.user_id = auth.uid()
    )
  );

CREATE POLICY "chat_groups_insert" ON chat_groups
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    chat_groups.created_by = auth.uid()
  );

CREATE POLICY "chat_groups_update" ON chat_groups
  FOR UPDATE USING (
    chat_groups.created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM chat_members 
      WHERE chat_members.group_id = chat_groups.id 
      AND chat_members.user_id = auth.uid()
    )
  );

CREATE POLICY "chat_groups_delete" ON chat_groups
  FOR DELETE USING (
    chat_groups.created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM chat_members 
      WHERE chat_members.group_id = chat_groups.id 
      AND chat_members.user_id = auth.uid()
    )
  );

-- ============================================================
-- chat_messages: Check chat_members only (no chat_groups)
-- ============================================================
CREATE POLICY "chat_messages_select" ON chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_members 
      WHERE chat_members.group_id = chat_messages.group_id 
      AND chat_members.user_id = auth.uid()
    )
  );

CREATE POLICY "chat_messages_insert" ON chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_members 
      WHERE chat_members.group_id = chat_messages.group_id 
      AND chat_members.user_id = auth.uid()
    )
  );

CREATE POLICY "chat_messages_update" ON chat_messages
  FOR UPDATE USING (sender_id = auth.uid());

CREATE POLICY "chat_messages_delete" ON chat_messages
  FOR DELETE USING (sender_id = auth.uid());

-- STEP 4: Add performance indexes
CREATE INDEX IF NOT EXISTS idx_chat_members_user_id ON chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_group_id ON chat_members(group_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_combo ON chat_members(group_id, user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_group_id ON chat_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_combo ON chat_messages(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_groups_updated_at ON chat_groups(updated_at DESC);

-- STEP 5: Add trigger to auto-update chat_groups.updated_at
CREATE OR REPLACE FUNCTION update_chat_group_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_groups 
  SET updated_at = NOW() 
  WHERE id = NEW.group_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_chat_group_timestamp ON chat_messages;
CREATE TRIGGER trigger_update_chat_group_timestamp
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_group_timestamp();

-- STEP 6: Re-enable RLS on all tables
ALTER TABLE chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- DONE! Now refresh your application
-- All chat tables now have clean RLS policies without recursion
-- ================================================================
