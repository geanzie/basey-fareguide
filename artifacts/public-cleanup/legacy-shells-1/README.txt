Slice: legacy-shells-1
Schema: public
Generated at: 2026-04-10T00:33:37.771Z

Artifacts:
- report.json contains row counts, sizes, columns, constraints, indexes, and dependency evidence.
- data/*.json contains raw row exports for each table.

Note:
pg_dump is not available in this environment, so this export is JSON-plus-metadata rather than a native PostgreSQL dump.
Use a Neon branch or clone as the primary rollback path when executing destructive cleanup.
