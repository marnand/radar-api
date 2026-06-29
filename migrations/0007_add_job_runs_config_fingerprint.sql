ALTER TABLE job_runs
  ADD COLUMN IF NOT EXISTS config_fingerprint TEXT;
