# AICRATIVE

AICRATIVE is a browser-based creative prompt studio. It uses **one generation engine only: the deterministic Local Creative Engine** in `src/engines/`. Character, Story, Scene, Image Prompt, and Video Prompt are generated in the browser. No external AI provider or xKiro/Qwen generation endpoint is used by the application.

## Canonical domain

The single public domain for AICRATIVE is:

- **https://aicrative.my.id**

The Vercel-provided `aicrative-ai.vercel.app` address is a deployment hostname, not a second product domain. Configure `aicrative.my.id` as the Primary Domain in Vercel and redirect the Vercel hostname to it. Keep only the canonical domain in public-facing links and Supabase Auth Site URL.

## Generation architecture

- `src/engines/storyEngine.ts`: deterministic story bible and story structure.
- `src/engines/sceneEngine.ts`: scene breakdown.
- `src/engines/characterEngine.ts`: character profile and reference prompt.
- `src/engines/imagePromptEngine.ts`: image still-frame prompts.
- `src/engines/videoPromptEngine.ts`: video generation prompts.
- `src/engines/index.ts`: single orchestration entry point.

Supabase is used for authentication and cloud project storage only. It is not a generation engine. The old standalone AI Studio page and its xKiro connector have been removed so users cannot access a second generator from the deployed static assets.

## Supabase setup

1. Open the Supabase project used by AICRATIVE.
2. Open **SQL Editor** and run the complete migration in `supabase/migrations/202610300001_aicrative_accounts_projects.sql`.
3. In **Project Settings → API**, copy the Project URL and the Publishable key (or legacy anon key). Do not use the service-role/secret key in the frontend.
4. In Vercel → Project → Settings → Environment Variables, add:
   - `VITE_SUPABASE_URL` = the Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = the Publishable key (`sb_publishable_...`) or anon key
5. Redeploy the Vercel project so Vite can embed the public configuration at build time.
6. In Supabase → Authentication → URL Configuration, set the Site URL to `https://aicrative.my.id`. Add required authentication callback URLs only if the sign-in flow needs them.
7. For public self-registration, configure email delivery and decide whether email confirmation is required.

## Shared access gate

- Configure `AICRATIVE_ACCESS_PASSWORD` as a server-only environment variable in Vercel. Never prefix it with `VITE_` and never place its value in client code.
- The access endpoint issues a signed, time-limited, HttpOnly cookie and applies per-instance in-memory throttling. The throttling is best-effort and is not a distributed rate limiter; use an edge/WAF or shared rate-limit store for stronger production abuse protection.
- The shared password gate controls access to the studio interface. It is not a substitute for Supabase authentication or database Row Level Security; project data must remain protected by the user's Supabase session and RLS policies.
- Existing browsers with an older access cookie may need to enter the shared password again after security updates.

## Data and security

- Each signed-in account can only access its own project rows. PostgreSQL Row Level Security (RLS) enforces this using `auth.uid() = user_id`.
- A fresh browser session opens the email sign-in/registration screen instead of silently creating an anonymous Supabase account.
- The browser uses only the Supabase Publishable/anon key and the signed-in user's access token. Never put a service-role key in Vercel variables prefixed with `VITE_`.
- Existing projects saved in the old browser `localStorage` are imported to the first signed-in account when that account has no cloud projects. Keep a backup of browser data until migration is confirmed.
- Local Creative Engine processing happens in the browser. Supabase is used for authentication and cloud project storage only.

## Run locally

Copy `.env.example` to `.env.local`, fill in the two public Supabase values, then run:

```bash
npm install
npm run dev
```

The Vite development server serves the frontend only. To test the Vercel `/api/access` serverless function locally, use `npx vercel dev` after configuring the server-only environment variables.

## Checks

```bash
npm run test
npm run lint
npm run build
```
