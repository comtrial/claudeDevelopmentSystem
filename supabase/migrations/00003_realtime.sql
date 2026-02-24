-- ============================================================================
-- Migration: 00003_realtime.sql
-- Description: Enable Supabase Realtime for live-updating tables
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pipelines;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
