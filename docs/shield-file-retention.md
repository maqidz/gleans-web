# Shield file cleanup

The cleanup endpoint removes original documents and reports only for paid, completed
orders whose `report_expires_at` has passed. Order history and immutable file references
are retained; `files_deleted_at` records successful physical deletion. Unpaid orders,
unfinished examinations, and abandoned uploads are outside this policy.

## Activation

1. Apply `migrations/20261113090000_shield-file-retention.sql` to the linked backend.
2. Configure a random server-only `CRON_SECRET` (at least 32 characters) on the website.
3. Deploy the website containing `/api/cron/cleanup-shield`.
4. Configure an InsForge HTTP schedule every 5 minutes (`*/5 * * * *`), GET the
   deployed endpoint, with `Authorization: Bearer <CRON_SECRET>` supplied through a
   scheduler secret. Do not put the credential in this repository.
5. Verify schedule logs: the response includes checked, deleted, failed. An error
   returns 503 so monitoring can detect it. No document names, keys or contacts are
   returned.

Each invocation handles up to 25 oldest expired orders. Deletion occurs on the next
successful run after expiry, not at an exact second; monitor backlog at larger volume.
Retries tolerate files already removed (404). Partial failures do not mark the order
as deleted. Existing published-report immutability prevents replacement during cleanup.

No live schedule is enabled by merely adding this code. Do not claim retention is
active until the deployment, secret, migration, and scheduler have been verified.
