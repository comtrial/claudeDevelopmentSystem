-- ============================================================================
-- Migration: 00001_initial_schema.sql
-- Description: Initial database schema for claudeDevelopmentSystem
-- Tables: profiles, pipelines, tasks, agents, sessions, agent_logs,
--         code_changes, pipeline_history, user_settings
-- ============================================================================

-- ===================
-- 1. profiles
-- ===================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===================
-- 2. pipelines
-- ===================
CREATE TABLE public.pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','running','paused','completed','failed','cancelled')),
  mode TEXT NOT NULL DEFAULT 'auto_edit'
    CHECK (mode IN ('auto_edit','review','plan_only')),
  config JSONB NOT NULL DEFAULT '{}',
  preset_template_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- ===================
-- 3. tasks
-- ===================
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'general'
    CHECK (type IN ('general','code','review','plan','test')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','completed','failed','skipped')),
  order_index INT NOT NULL DEFAULT 0,
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===================
-- 4. agents
-- ===================
CREATE TABLE public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('pm','engineer','reviewer')),
  instruction TEXT,
  model TEXT NOT NULL DEFAULT 'claude-sonnet-4-5-20250929',
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ===================
-- 5. sessions
-- ===================
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'initializing'
    CHECK (status IN ('initializing','running','paused','completed','failed','cancelled')),
  token_usage INT DEFAULT 0,
  token_limit INT DEFAULT 100000,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

-- ===================
-- 6. agent_logs
-- ===================
CREATE TABLE public.agent_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  agent_role TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info'
    CHECK (level IN ('debug','info','warn','error')),
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ===================
-- 7. code_changes
-- ===================
CREATE TABLE public.code_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  diff_content TEXT NOT NULL,
  change_type TEXT NOT NULL
    CHECK (change_type IN ('added','modified','deleted','renamed')),
  additions INT DEFAULT 0,
  deletions INT DEFAULT 0,
  review_status TEXT DEFAULT 'pending'
    CHECK (review_status IN ('pending','approved','rejected','changes_requested')),
  reviewer_comments JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ===================
-- 8. pipeline_history
-- ===================
CREATE TABLE public.pipeline_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT,
  status TEXT NOT NULL,
  total_tokens INT DEFAULT 0,
  total_duration_sec INT DEFAULT 0,
  task_count INT DEFAULT 0,
  file_changes_count INT DEFAULT 0,
  config_snapshot JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ===================
-- 9. user_settings
-- ===================
CREATE TABLE public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  default_mode TEXT DEFAULT 'auto_edit',
  default_model TEXT DEFAULT 'claude-sonnet-4-5-20250929',
  notification_preferences JSONB DEFAULT '{"toast": true, "modal": true, "email": false}',
  api_keys JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX idx_pipelines_user_id ON public.pipelines(user_id);
CREATE INDEX idx_pipelines_status ON public.pipelines(status);
CREATE INDEX idx_tasks_pipeline_id ON public.tasks(pipeline_id);
CREATE INDEX idx_agents_pipeline_id ON public.agents(pipeline_id);
CREATE INDEX idx_sessions_pipeline_id ON public.sessions(pipeline_id);
CREATE INDEX idx_agent_logs_session_id ON public.agent_logs(session_id);
CREATE INDEX idx_agent_logs_created_at ON public.agent_logs(created_at);
CREATE INDEX idx_code_changes_session_id ON public.code_changes(session_id);
CREATE INDEX idx_pipeline_history_user_id ON public.pipeline_history(user_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- ===================
-- RLS Policies: profiles
-- ===================
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ===================
-- RLS Policies: pipelines
-- ===================
CREATE POLICY "Users can view own pipelines"
  ON public.pipelines FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own pipelines"
  ON public.pipelines FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own pipelines"
  ON public.pipelines FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own pipelines"
  ON public.pipelines FOR DELETE
  USING (user_id = auth.uid());

-- ===================
-- RLS Policies: tasks
-- ===================
CREATE POLICY "Users can view tasks of own pipelines"
  ON public.tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pipelines
      WHERE pipelines.id = tasks.pipeline_id
        AND pipelines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create tasks in own pipelines"
  ON public.tasks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pipelines
      WHERE pipelines.id = tasks.pipeline_id
        AND pipelines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update tasks in own pipelines"
  ON public.tasks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.pipelines
      WHERE pipelines.id = tasks.pipeline_id
        AND pipelines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete tasks in own pipelines"
  ON public.tasks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.pipelines
      WHERE pipelines.id = tasks.pipeline_id
        AND pipelines.user_id = auth.uid()
    )
  );

-- ===================
-- RLS Policies: agents
-- ===================
CREATE POLICY "Users can view agents of own pipelines"
  ON public.agents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pipelines
      WHERE pipelines.id = agents.pipeline_id
        AND pipelines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create agents in own pipelines"
  ON public.agents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pipelines
      WHERE pipelines.id = agents.pipeline_id
        AND pipelines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update agents in own pipelines"
  ON public.agents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.pipelines
      WHERE pipelines.id = agents.pipeline_id
        AND pipelines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete agents in own pipelines"
  ON public.agents FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.pipelines
      WHERE pipelines.id = agents.pipeline_id
        AND pipelines.user_id = auth.uid()
    )
  );

-- ===================
-- RLS Policies: sessions
-- ===================
CREATE POLICY "Users can view sessions of own pipelines"
  ON public.sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pipelines
      WHERE pipelines.id = sessions.pipeline_id
        AND pipelines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create sessions in own pipelines"
  ON public.sessions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pipelines
      WHERE pipelines.id = sessions.pipeline_id
        AND pipelines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update sessions in own pipelines"
  ON public.sessions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.pipelines
      WHERE pipelines.id = sessions.pipeline_id
        AND pipelines.user_id = auth.uid()
    )
  );

-- ===================
-- RLS Policies: agent_logs
-- ===================
CREATE POLICY "Users can view logs of own sessions"
  ON public.agent_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions
      JOIN public.pipelines ON pipelines.id = sessions.pipeline_id
      WHERE sessions.id = agent_logs.session_id
        AND pipelines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create logs in own sessions"
  ON public.agent_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions
      JOIN public.pipelines ON pipelines.id = sessions.pipeline_id
      WHERE sessions.id = agent_logs.session_id
        AND pipelines.user_id = auth.uid()
    )
  );

-- ===================
-- RLS Policies: code_changes
-- ===================
CREATE POLICY "Users can view code changes of own sessions"
  ON public.code_changes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions
      JOIN public.pipelines ON pipelines.id = sessions.pipeline_id
      WHERE sessions.id = code_changes.session_id
        AND pipelines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create code changes in own sessions"
  ON public.code_changes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions
      JOIN public.pipelines ON pipelines.id = sessions.pipeline_id
      WHERE sessions.id = code_changes.session_id
        AND pipelines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update code changes in own sessions"
  ON public.code_changes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions
      JOIN public.pipelines ON pipelines.id = sessions.pipeline_id
      WHERE sessions.id = code_changes.session_id
        AND pipelines.user_id = auth.uid()
    )
  );

-- ===================
-- RLS Policies: pipeline_history
-- ===================
CREATE POLICY "Users can view own pipeline history"
  ON public.pipeline_history FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own pipeline history"
  ON public.pipeline_history FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ===================
-- RLS Policies: user_settings
-- ===================
CREATE POLICY "Users can view own settings"
  ON public.user_settings FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own settings"
  ON public.user_settings FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================================================
-- TRIGGERS: updated_at auto-update
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_pipelines
  BEFORE UPDATE ON public.pipelines
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_tasks
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_user_settings
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
