-- New invoices use eight uppercase hex characters. Existing gateway IDs stay valid.
ALTER TABLE public.duitku_orders DROP CONSTRAINT duitku_orders_id_check;
ALTER TABLE public.duitku_orders ADD CONSTRAINT duitku_orders_id_check
  CHECK (id ~ '^GLS-([0-9A-F]{8}|[0-9A-F]{12}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$');
