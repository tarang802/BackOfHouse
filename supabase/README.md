# Supabase

`migrations/` holds the complete, ordered database definition. Apply it to a fresh project:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Or, with Docker, run everything locally:

```bash
npx supabase start
npx supabase db reset
```

No Docker? `npm test` still exercises every migration: the database tests boot PGlite
(in-process Postgres) and apply `tests/db/supabase-shim.sql` followed by these files.

See `docs/DATABASE.md` for the table design, security model and function reference.
