# Third-party components

## 2026-10-06 — Resumable Curiosity Shorts generation

No third-party package, repository code, model provider or SDK was added. The independently implemented workflow reuses the existing Anthropic integration but requests the four Shorts as four bounded JSON cards. Each successful card is persisted locally before the next request; a retry resumes from the saved card instead of repeating completed model calls. The change reduces output-truncation risk and unnecessary paid retries without sending the source to any new service.

## 2026-10-04 — Director Room

No third-party package, repository code, asset, external media API or browser-automation SDK was added. The independently implemented Director Room extends the existing Film Assistant, React interface, local Film Studio state and Anthropic text integration. It stores three bounded directing approaches (`simple`, `cinematic`, `bold`), requires the author to approve one, and passes only that approved creative brief into the existing film-package generator.

The feature does not connect to Figma Weave, create or edit a Weave workflow, upload references, or start image/video generation. Weave remains a future manually controlled browser destination; every credit-consuming run will require separate explicit confirmation. No external implementation code was copied.

## 2026-10-01 — Full-screen Film Studio and Film Assistant

No npm package, repository code, new API provider or SDK was added. The independently implemented Film Assistant reuses the existing paid Anthropic integration, so each assistant request may incur ordinary Anthropic usage. The configured economical model handles ordinary advice and bounded storyboard commands, while the existing Film Studio model handles explicit creative rewrites. The server returns only a whitelisted proposal; project changes happen locally after user confirmation and can be undone.

The assistant accepts ordinary text in a standard textarea, so operating-system dictation or another external text-input feature can be used where available. Film Assistant itself has no microphone integration and does not capture, upload or store audio. No external implementation code was copied.

## 2026-10-01 — Film Reference Pack and keyframe review

No third-party package, repository code, asset, paid API or image-generation service was added. The independently implemented workflow uses the browser's native IndexedDB, Blob/File and object-URL APIs to keep reference images and keyframes on the user's device. Temporary preview URLs are created only in memory and revoked after use. Higgsfield remains a manually opened external service: the application does not upload files to it, select a paid model or trigger a charge.

Technical basis verified 2026-10-01 against the [W3C IndexedDB 3.0 specification](https://www.w3.org/TR/IndexedDB-3/) and the [W3C File API](https://www.w3.org/TR/FileAPI/). No external implementation code was copied.

## 2026-09-30 — Music Video Production Director

No third-party package, repository code, asset or paid media API was added. The independently implemented text review reuses the existing Anthropic request that creates the shot plan. It labels generation, regeneration and continuity risk, lists only necessary references, and proposes a simpler director version while leaving the final choice to the user. Higgsfield remains a manually opened external service; no generation or charge is triggered by the application.

## 2026-09-29 — AI Film Studio Music Video Director

No third-party package, repository code or asset was added. Audio duration and coarse section energy are calculated locally with the browser's native Web Audio API; the audio file is not uploaded or persisted. Concept and shot text reuse the existing Anthropic integration. Higgsfield is an optional manual destination opened by the user: no Higgsfield API, model capability claim, paid generation or vendor SDK is included. Prompts remain provider-neutral and the user chooses an available video model in the external service.

## 2026-09-14 — LinkedIn image style update

No third-party package or asset was added. The feature reuses the existing OpenAI image API integration and project code.

## 2026-09-14 — Free official news feeds

No package or paid search API was added. The app reads the public RSS/Atom feeds published by OpenAI, Google AI and Microsoft Source and links every item back to its original page. Feed content remains subject to each publisher's terms; only short metadata and summaries are retained for editorial selection.

Russian translation of the selected feed metadata reuses the project's existing Anthropic Claude API integration. No additional provider, SDK, or dependency was added.

## 2026-09-15 — Build Report Import

No third-party component was added. Markdown and JSON reports are read with the browser File API; fact extraction and story selection reuse the existing Anthropic Claude API integration. The implementation is original project code and stores source linkage in the existing local LinkedIn content plan.

## 2026-09-17 — Custom script content workflow

No third-party component or dependency was added. The workflow reuses the existing Shorts, Community, Telegram and Boosty generation endpoints. A user-supplied four-Shorts script works without a Long-video title and replaces research-derived topic metadata before generation.

## 2026-09-17 — Four-topic content-week architecture

No third-party component or dependency was added. The application treats four Shorts as four independent text sources, maps them to four useful YouTube Community posts, four Telegram posts and two Boosty articles, then reuses four topic-specific square publication images across those platforms. Shorts imagery remains outside the application workflow.

## 2026-09-26 — Curiosity Story Shorts

No third-party component or dependency was added. An independently implemented prompt and response normalizer convert one user-supplied four-section source into four evidence-preserving Curiosity Story Shorts, then reuse the existing Community, Telegram, Boosty, image and publication-plan pipeline. The LinkedIn workspace remains isolated and unchanged.

## 2026-09-26 — Angle Lab, Hook Lab and script audit

No third-party component, code or dependency was added. The feature independently extends the existing Curiosity Story response and Shorts cards with three editorial angles, three hook mechanisms, a user-controlled rewrite action and qualitative checks for open-loop closure, value density and promise alignment. It reuses the existing Anthropic endpoint and local persisted state; LinkedIn remains isolated and unchanged.

## 2026-09-28 — AI Film Studio MVP

No third-party component, repository code, asset or dependency was added. The implementation is original project code and reuses React, IndexedDB persistence, the existing Anthropic endpoint and copy controls. It provides a manual/generated idea bank and a provider-neutral production package for external image, video and voice tools. `video-shotcraft`, `take`, Kinocut, Remotion, Midjourney and video-generation providers were not integrated in this phase; therefore they add no license, cost or lock-in obligations. LinkedIn and the existing music workflow remain isolated.

## 2026-09-28 — Film series theme selection

No third-party component or dependency was added. The original Film Studio workflow now separates broad series themes from individual episode ideas, supports manual themes and author refinements, and explicitly isolates film generation from the music-channel biography. Each selected theme produces five standalone-but-related episode concepts before the user approves one for production.

## 2026-09-28 — Claude Sonnet 5 for Film Studio

No new dependency was added. Film Studio theme, episode and production-package requests now explicitly use the official Claude API model ID `claude-sonnet-5`; other application workflows keep their existing model selection. The implementation is compatible with Sonnet 5 adaptive thinking because response parsing already selects text blocks by type and does not set unsupported sampling parameters. Cost tracking uses Anthropic's published $2 input / $10 output per million token rates, verified 2026-09-28 from the official migration guide and model documentation.

Film Studio sets the official `output_config.effort` control to `low` so the server receives a timely response within the hosting request window. Creative quality is guided by the film-specific system prompt; no sampling parameters are set. This follows Anthropic's official recommendation to lower effort for speed-sensitive requests.

Because the hosting request window is approximately 30 seconds and Sonnet 5 adaptive thinking exceeded it even at low effort, Film Studio explicitly disables hidden thinking for these single-pass creative JSON generations. The model and creative prompt remain Sonnet 5; only the internal reasoning phase is removed to prevent network resets.

Theme and episode batches run sequentially rather than concurrently. This avoids intermittent upstream connection resets while keeping every individual Sonnet 5 request below the hosting limit; the interface shows batch progress and combines the results behind one button.

Verified: 2026-08-18. Versions are the installed versions recorded by `package-lock.json`.

| Component | Version | Source | License | Use |
| --- | --- | --- | --- | --- |
| `@anthropic-ai/sdk` | 0.39.0 | https://www.npmjs.com/package/@anthropic-ai/sdk | MIT | Anthropic API client |
| `react` | 18.3.1 | https://www.npmjs.com/package/react | MIT | User interface |
| `react-dom` | 18.3.1 | https://www.npmjs.com/package/react-dom | MIT | Browser rendering |
| `youtube-transcript` | 1.3.1 | https://www.npmjs.com/package/youtube-transcript | MIT | Video transcript retrieval |
| `@vitejs/plugin-react` | 4.7.0 | https://www.npmjs.com/package/@vitejs/plugin-react | MIT | React build integration (development) |
| `vite` | 5.4.21 | https://www.npmjs.com/package/vite | MIT | Build tooling (development) |

No new third-party component was added for the audience-analysis load fix. The bounded-concurrency helper is an independent implementation using native JavaScript promises.

No new third-party component was added for the four-Shorts workflow and automatic description links. The description-link composer is an independent implementation using native JavaScript.

No new third-party component was added for the LinkedIn weekly-news digest importer. It uses the existing Anthropic client and independently implemented normalization.
