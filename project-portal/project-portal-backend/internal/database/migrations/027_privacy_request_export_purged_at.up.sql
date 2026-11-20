-- Migration: 027_privacy_request_export_purged_at
-- Description: Track when the cleanup worker (issue #691) deleted a
--              completed export request's file from storage, so an
--              already-purged export is never purged (or billed for
--              storage) again. export_file_url is left untouched so the
--              request record still shows what was generated even after
--              the underlying file is gone.
-- Date: 2026-10-19

ALTER TABLE privacy_requests ADD COLUMN IF NOT EXISTS export_purged_at TIMESTAMPTZ;
