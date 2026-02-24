-- Follow-up session support: add chain fields to sessions table
ALTER TABLE public.sessions
  ADD COLUMN follow_up_prompt TEXT,
  ADD COLUMN parent_session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  ADD COLUMN session_number INT NOT NULL DEFAULT 1;

CREATE INDEX idx_sessions_parent ON public.sessions(parent_session_id);
