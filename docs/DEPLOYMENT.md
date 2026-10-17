# Deploying to Vercel + Supabase

Total time: about 15 minutes. You need a GitHub account (the code is in
`tarang802/BackOfHouse`), a free Supabase account and a free Vercel account.

## 1. Create the Supabase project

1. https://supabase.com/dashboard → **New project**. Pick a region close to your players
   (e.g. Mumbai `ap-south-1` for India). Save the database password somewhere safe.
2. **Project Settings → API**: note the **Project URL** and the **publishable key**
   (`sb_publishable_…`). Older projects show an `anon` key instead — that works too.

## 2. Create the database

From your computer, in the project folder:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>     # the id in your project URL
npx supabase db push                               # applies supabase/migrations in order
```

No CLI? Open **SQL Editor** and run each file in `supabase/migrations` in filename order.

Check: **Table Editor** lists `profiles`, `clubs`, `matches` … with RLS enabled (shield icon),
and **Storage** has a public `avatars` bucket.

## 3. Configure authentication

**Authentication → Sign In / Providers → Email**: enabled, “Confirm email” on.

**Authentication → URL Configuration** (fill in after step 4 if you do not know the domain yet):

| Setting | Value |
| --- | --- |
| Site URL | `https://<your-app>.vercel.app` |
| Redirect URLs | `https://<your-app>.vercel.app/auth/confirm` and `http://localhost:3000/auth/confirm` |

The app handles both the default PKCE links (`?code=`) and token-hash email templates at
`/auth/confirm`. Recovery links land on `/reset-password`. Open email links on the same device
you requested them from.

Optional: Supabase's built-in email sender is rate limited; for a real group add custom SMTP
under **Authentication → Emails → SMTP**.

## 4. Deploy on Vercel

1. https://vercel.com/new → **Import** `tarang802/BackOfHouse`. Framework: Next.js (auto).
2. **Environment Variables** (Production and Preview):

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL from step 1 |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable (or anon) key |
   | `NEXT_PUBLIC_SITE_URL` | `https://<your-app>.vercel.app` (no trailing slash) |

   Do **not** add `SUPABASE_SECRET_KEY` to Vercel — the app never needs it.
3. **Deploy.** Build command `npm run build`, output handled by Vercel. Node 20+.
4. Go back to step 3 and set the Site URL / Redirect URLs to the deployed domain.

If the variables are missing, the deployed site shows a friendly `/setup` page instead of
crashing.

## 5. Smoke test the deployment

1. Open the site → **Enter the Club** → **Create an account** → confirm the email.
2. Create your player card, then **Open a new club**.
3. **Club settings → Invite friends → Copy link**; open it in a private window, sign up as a
   second user and join.
4. **Record a match** (two players), confirm the dashboard and leaderboard update on both
   browsers (realtime refresh), then void it from the match page and see the points vanish.
5. As a member who is not an admin, confirm Settings shows no invitation codes and no admin
   controls.

## Updating the database later

Add a new timestamped file to `supabase/migrations`, run `npm test` (applies every migration
to PGlite), then `npx supabase db push`. Never edit a migration that has already been applied.

## Operational notes

- Backups: Supabase takes daily backups on paid plans; on the free plan export periodically
  (`npx supabase db dump`).
- Removing a member keeps their match history (by design). Deleting an auth user who appears
  in match history is blocked by foreign keys; remove them from clubs instead.
- Avatars are public URLs (they appear on leaderboards); only the owner can write to their
  folder.
