# AICRATIVE

AICRATIVE is a browser-based creative prompt studio. It uses **one generation engine only: the deterministic Local Creative Engine** in `src/engines/`. Character, Story, Scene, and Image Prompt are generated in the browser. Video Prompt visual fields are translated and optimized per scene through a server-side Gemini API route; dialogue is preserved verbatim. No xKiro/Qwen generation endpoint is used.

## Canonical domain

The single public domain for AICRATIVE is:

- **https://aicrative.my.id**

The Vercel-provided `aicrative-ai.vercel.app` address is a deployment hostname, not a second product domain. Configure `aicrative.my.id` as the Production domain in Vercel and redirect alternate hostnames to it. Keep only the canonical domain in public-facing links.

## Generation architecture

- `src/engines/storyEngine.ts`: deterministic story bible and story structure.
- `src/engines/sceneEngine.ts`: scene breakdown.
- `src/engines/characterEngine.ts`: character profile and reference prompt.
- `src/engines/imagePromptEngine.ts`: image still-frame prompts.
- `src/engines/videoPromptEngine.ts`: local video prompt composition helpers.\n- `api/video-prompts.js`: authenticated server-side Gemini translation and Google Flow prompt composition for every scene. The browser never receives the Gemini API key.
- `src/engines/index.ts`: single orchestration entry point.

The Local Creative Engine builds story and scene structures and does not create actual image or video files. Gemini is used only to translate and optimize video-prompt text, not to generate media. Supabase is used only as cloud storage for the shared project workspace. Standard mode creates one prompt per scene; Cinematic mode creates a shot-by-shot prompt sequence.

## Access model: one shared password

- The login screen asks for **one password only**. There is no email field, user registration, or per-user account.
- Configure `AICRATIVE_ACCESS_PASSWORD` as a server-only Vercel environment variable. Never prefix it with `VITE_` or put its value in browser code.
- `/api/access` validates the password on the server and issues a signed, time-limited, HttpOnly, Secure, SameSite cookie.
- Every person who has the shared password enters the same cloud workspace and can see, edit, and delete the same projects across devices.
- The access endpoint uses per-instance in-memory throttling. This is best-effort, not a distributed rate limiter; use a WAF or shared rate-limit service for stronger abuse protection.
- Changing `AICRATIVE_ACCESS_PASSWORD` invalidates existing signed cookies. Users will need to enter the new password.

## Supabase shared project storage setup

1. Open the Supabase project used by AICRATIVE.
2. Open **SQL Editor** and run `supabase/migrations/202611010001_aicrative_shared_projects.sql`.
3. In Vercel → Project → Settings → Environment Variables, add these server-side variables for Production (and Preview only if needed):
   - `AICRATIVE_ACCESS_PASSWORD` = the shared password chosen by the owner
   - `SUPABASE_URL` = the Supabase Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = the Supabase service-role/secret key\n   - `GEMINI_API_KEY` = a Google AI Studio API key used only by the server-side Flow prompt translator
4. **Never** name the service-role variable `VITE_SUPABASE_SERVICE_ROLE_KEY`; never expose it in client-side code or commit it to Git.
5. Redeploy the Vercel project after the environment variables and SQL migration are ready.

The Vercel APIs verify the HttpOnly access cookie before using the service-role key to read/write `public.shared_projects` or call Gemini for prompt translation. Row Level Security is enabled on that table and no browser roles receive access; the service-role key stays server-side.

## Existing Supabase Auth settings

The application no longer uses Supabase Auth for end-user login. The Supabase Authentication Site URL / Redirect URL settings do not control the AICRATIVE shared-password gate. They may remain configured, but they are not part of this login flow.

## Existing data

The previous implementation stored projects per Supabase Auth user in `public.projects`. The shared-password workspace uses a separate `public.shared_projects` table so existing account-specific rows are not silently exposed or merged. If there are existing projects to retain, export or migrate them deliberately after reviewing their ownership. Legacy browser-local projects are imported into the shared workspace when the shared workspace is empty.

## Run locally

The frontend runs with Vite:

```bash
npm install
npm run dev
```

The Vercel API routes require the server-only environment variables above. Use `npx vercel dev` to test the complete shared-password and cloud-storage flow locally.

## Checks

```bash
npm run test
npm run lint
npm run build
```
