-- Preserve immutable order/report references for audit, and record successful removal.
ALTER TABLE public.duitku_orders ADD COLUMN IF NOT EXISTS files_deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS duitku_files_cleanup_due
 ON public.duitku_orders(report_expires_at)
 WHERE fulfillment_status = 'completed' AND files_deleted_at IS NULL;
