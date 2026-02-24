-- ============================================================================
-- Migration: 00006_agents_status_columns.sql
-- Description: Add missing status/progress columns to agents table
-- ============================================================================

ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'idle'
  CHECK (status IN ('idle','active','paused','completed','error'));
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS current_task TEXT;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS progress INT DEFAULT 0;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Add UPDATE policies (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update agents in own pipelines' AND tablename = 'agents'
  ) THEN
    CREATE POLICY "Users can update agents in own pipelines"
      ON public.agents FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.pipelines
          WHERE pipelines.id = agents.pipeline_id
            AND pipelines.user_id = auth.uid()
        )
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update tasks in own pipelines' AND tablename = 'tasks'
  ) THEN
    CREATE POLICY "Users can update tasks in own pipelines"
      ON public.tasks FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.pipelines
          WHERE pipelines.id = tasks.pipeline_id
            AND pipelines.user_id = auth.uid()
        )
      );
  END IF;
END $$;
