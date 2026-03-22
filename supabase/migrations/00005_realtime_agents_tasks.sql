-- ============================================================================
-- Migration: 00005_realtime_agents_tasks.sql
-- Description: Add agents and tasks tables to Supabase Realtime publication
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.agents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
