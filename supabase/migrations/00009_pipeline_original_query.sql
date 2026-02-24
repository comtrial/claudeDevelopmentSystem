-- Add original_query column to store user's raw input text
ALTER TABLE public.pipelines
  ADD COLUMN original_query TEXT;

COMMENT ON COLUMN public.pipelines.original_query IS 'User''s original natural language query that created this pipeline';
