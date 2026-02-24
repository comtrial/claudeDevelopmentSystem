-- Auto-cleanup: delete oldest 100MB of agent_logs when total DB exceeds 400MB
-- Threshold set at 400MB to keep well under 500MB free tier limit

CREATE OR REPLACE FUNCTION public.cleanup_old_logs(threshold_mb INT DEFAULT 400, delete_mb INT DEFAULT 100)
RETURNS TABLE(deleted_count BIGINT, db_size_mb NUMERIC) AS $$
DECLARE
  current_size_mb NUMERIC;
  target_delete BIGINT;
  avg_row_bytes NUMERIC;
  total_rows BIGINT;
  rows_deleted BIGINT;
BEGIN
  -- Get current DB size in MB
  SELECT pg_database_size(current_database()) / (1024.0 * 1024.0) INTO current_size_mb;

  IF current_size_mb < threshold_mb THEN
    -- Under threshold, no cleanup needed
    RETURN QUERY SELECT 0::BIGINT, current_size_mb;
    RETURN;
  END IF;

  -- Estimate average row size and total rows in agent_logs
  SELECT COUNT(*) INTO total_rows FROM public.agent_logs;

  IF total_rows = 0 THEN
    RETURN QUERY SELECT 0::BIGINT, current_size_mb;
    RETURN;
  END IF;

  SELECT pg_total_relation_size('public.agent_logs') / NULLIF(total_rows, 0)::NUMERIC
    INTO avg_row_bytes;

  -- Calculate how many rows to delete for ~delete_mb
  target_delete := (delete_mb * 1024.0 * 1024.0 / NULLIF(avg_row_bytes, 0))::BIGINT;

  -- Delete the oldest rows
  WITH to_delete AS (
    SELECT id FROM public.agent_logs
    ORDER BY created_at ASC
    LIMIT target_delete
  )
  DELETE FROM public.agent_logs
  WHERE id IN (SELECT id FROM to_delete);

  GET DIAGNOSTICS rows_deleted = ROW_COUNT;

  -- Return results
  RETURN QUERY SELECT rows_deleted, current_size_mb;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service_role only (not anon)
REVOKE ALL ON FUNCTION public.cleanup_old_logs FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_old_logs TO service_role;
