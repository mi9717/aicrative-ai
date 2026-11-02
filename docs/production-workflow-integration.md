# AICRATIVE production workflow integration

## Goal

Strengthen the existing Character → Story → Scene → Image Prompt → Video Prompt workflow without replacing the current React/Vite application, shared-password access, Supabase shared workspace, or Vercel deployment.

## Adopted practices

This implementation is an original AICRATIVE implementation informed by public documentation from:

- [google-flow-scripting-skill](https://github.com/agbelemi/google-flow-scripting-skill) — MIT. Reference for canonical asset thinking, scene continuity, storyboard approval, and Google Flow prompt validation.
- [universal-video-skills](https://github.com/svenkatreddy/universal-video-skills) — MIT. Reference for shot-brief structure, character continuity, model adapters, and video QA.
- [dramai](https://github.com/hyyyyyyz/dramai) — Apache-2.0. Reviewed as an architectural reference for structured storyboards and provider abstraction. Its application architecture is not copied because AICRATIVE already has its own project and access model.

No third-party source files are copied into this repository. Keep these references and licenses visible when extending this work.

## Current implementation

The new api/lib/flow-prompt-structure.js module provides reusable prompt composition sections:

- Structured shot brief: format, subject, visible action, setting, camera, beats, audio, preserve, and avoid.
- Continuity audit: canonical character/reference guidance, world rules, location geometry, props, eyelines, screen direction, and conservative handling of unspecified details.

The api/video-prompts.js endpoint inserts these sections into every translated scene prompt. Dialogue remains a separate verbatim block and is not translated. Existing authentication, request validation, scene-order checks, and Gemini translation remain in place.

## Deliberately not imported

- dramai UI, routing, IndexedDB, settings, or provider-key storage.
- External video-generation APIs or browser automation.
- A new database schema or asset upload pipeline.
- Any model-specific promise that Google Flow will obey every prompt instruction.

## Next production milestones

1. Add explicit project-level asset registry records (character/location/prop IDs and reference-image links) to the existing project model.
2. Add storyboard/contact-sheet prompt generation and a human approval gate before video prompt generation.
3. Add provider adapters behind a common interface only when the product supports additional generators.
4. Add visual QA only when generated frames or clips are actually available to inspect.

## Verification

Run npm test, npm run lint, and npm run build.

Prompt structure tests are deterministic and do not call Gemini. A live Flow moderation or generation result cannot be guaranteed by unit tests.
