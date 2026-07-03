# Script frameworks

## Содержание

- [Карта выбора](#карта-выбора)
- [Long-form frameworks](#long-form-frameworks)
- [Shorts frameworks](#shorts-frameworks)
- [Re-hook building blocks](#re-hook-building-blocks-for-long-form)
- [CTA placement](#cta-placement)
- [Guardrails](#guardrails)
- [Sources](#sources)

## Карта выбора

| Задача | Long-form 5–20 минут | Shorts |
|---|---|---|
| Повторить действия | L01 tutorial | S01 result-first tutorial |
| Понять механизм | L02 guiding question, L07 progressive depth | S02 question/reveal |
| Исправить ошибку | L03 misconception, L05 diagnosis tree | S03 mistake/fix |
| Сравнить варианты | L06 experiment | S04 A/B criterion |
| Показать кейс | L04 case study, L06 experiment | S06 micro-story |
| Наглядная трансформация | L04 case study | S05 visual turn |

## Long-form frameworks

### L01. Reproducible tutorial

- sequence: `hook/result preview → exact promise → prerequisites → ordered steps → verification → recap → next step/CTA`.
- use: зритель должен повторить workflow.
- avoid: conceptual essay; несколько равноценных путей без одного recommended path.
- example: RAG-бот → готовое demo → requirements → ingest → retrieval → generation → 3 tests → checklist.
- source status: hypothesis grounded in expectation match and segmentation; [O1], [R1].

### L02. Guiding-question explainer

- sequence: `question → prior intuition → visible knowledge gap → model → examples/evidence → direct answer → implication`.
- use: AI mechanism, science explainer, music theory.
- avoid: срочный how-to, где модель задерживает действие.
- example: «Почему LLM галлюцинирует?» → prediction intuition → limits → examples → mechanism → mitigation.
- source status: research-compatible, not YouTube-retention proof; [R2], [R3].

### L03. Misconception correction

- sequence: `common belief → honest counterexample → mechanism → corrected model → transfer test`.
- use: реальный, проверяемый миф.
- avoid: straw man, спорный consensus, единичный counterexample без модели.
- example: «Watch time сам по себе не гарантирует продвижение» → counterexample → satisfaction/personalization → two-video transfer test.
- source status: pedagogical hypothesis; [O1].

### L04. Evidence-aware case study

- sequence: `outcome first → baseline → interventions one by one → evidence → failed attempt → lessons → limitations`.
- use: channel/workflow optimization, audio/code improvement.
- avoid: нет baseline, mixed interventions, claim of universal causality.
- example: Показать latency до/после → pipeline → каждое изменение и замер → провал → итог → ограничения железа.
- source status: hypothesis + official guidance to move compelling moments earlier; [O1].

### L05. Diagnostic tree

- sequence: `symptom → scope → branching tests → fix per cause → retest → prevention`.
- use: software errors, audio noise, export, AI configuration.
- avoid: high-stakes diagnosis or ситуация без надежных distinguishing tests.
- example: Clipping? buffer? cable? → отдельный тест → fix → контрольная запись.
- source status: hypothesis informed by signaling; [R4].

### L06. Transparent experiment narrative

- sequence: `question/stake → hypothesis → method and criterion → run → meaningful turns → result → explanation → limitations`.
- use: model/tool comparison, educational challenge.
- avoid: подстроенный результат, post-hoc criterion, развлечение вместо метода.
- example: «Сведет ли локальная модель трек?» → blind criteria → 3 tasks → failures → scores → interpretation.
- source status: hypothesis with indirect narrative evidence; [R5].

### L07. Progressive depth

- sequence: `safe quick answer → key terms → segmented core model → contrasting examples → edge cases → recap`.
- use: mixed beginner/advanced audience, complex concept.
- avoid: quick answer dangerous or misleading without context.
- example: Temperature range → parameter model → creative/factual examples → tool caveats → decision table.
- source status: learning research, not retention proof; [R1], [R4].

## Shorts frameworks

### S01. Result-first micro-tutorial

- sequence: `result in first beat → promise to reproduce → 1–3 essential actions → verification`.
- use: one function, one effect, one short workflow.
- avoid: prerequisites, safety caveats or input too long for the format.
- example: Vocal before/after → profile → reduction → mix → A/B.
- source status: hypothesis based on official first-seconds guidance; [O2].

### S02. Question and reveal

- sequence: `specific question → brief guess window/options → answer → one-sentence why → application`.
- use: quiz, fact, listening test, error recognition.
- avoid: subjective answer or no plausible guess.
- example: «Какой файл MP3?» → A/B → reveal → audible artifact → practical tip.
- source status: research-compatible; [R2], [R3].

### S03. Mistake and replacement

- sequence: `mistake → observable consequence → exact replacement → before/after proof`.
- use: prompt, code, captions, audio.
- avoid: rare mistake or exaggerated consequence.
- example: Overlong caption → comprehension loss → shorter line → corrected frame.
- source status: hypothesis; evaluate with Shorts metrics [O3].

### S04. A/B with one criterion

- sequence: `A and B immediately → one criterion → observation/measurement → winner for this case → caveat`.
- use: tools, settings, models, processing.
- avoid: fair criterion cannot fit; conditions differ.
- example: GPT vs local model on one JSON schema → validation → winner only on adherence.
- source status: hypothesis; [O3].

### S05. Visual turn

- sequence: `normal state → relevant visual/audio anomaly → mechanism → restored state`.
- use: interfaces, audio, physical/visual demo.
- avoid: decorative anomaly unrelated to learning.
- example: Groove disappears → show quantize 100% → restore 70% → A/B.
- source status: hypothesis based on first-seconds guidance; [O2].

### S06. Micro-story / bit

- sequence: `relevant shock → one intrigue → 1–2 beats → satisfy → clean end; loop only if semantically natural`.
- use: failure-and-fix, mini experiment, discovery.
- avoid: false shock, withheld answer, forced loop.
- example: Agent renames all stems → vague instruction revealed → safe instruction → restored order.
- source status: creator practice, not platform rule; [C1].

## Re-hook building blocks for long-form

- progress marker: `«Мы уже исключили A; теперь проверяем B»` — use after a completed segment, not every minute.
- unresolved consequence: `«Исправление X создает новую проблему Y»` — only if Y is real and soon addressed.
- contrast: `«На простом примере это работает; на edge case ломается вот здесь»` — use before a meaningful counterexample.
- checkpoint: one-sentence recap + next question — useful for dense material; avoid repeating the whole intro.
- evidence turn: show data/demo before interpretation — avoid selecting only supportive evidence.

## CTA placement

- Put the primary learning payoff before CTA.
- Prefer a relevant next action: test, checklist, next lesson, source file.
- Mid-roll CTA is optional and should sit at a natural segment boundary; there is no official universal timestamp.
- Never interrupt an unresolved safety-critical or procedural step.

## Guardrails

1. Make the opening fulfill the title/thumbnail expectation; investigate early dips rather than assuming one cause. [O1]
2. Do not stretch a Short idea into long-form or compress a prerequisite-heavy lesson into Shorts.
3. Use segment labels and recap to reduce complexity, not to manufacture constant «re-hooks». Learning evidence does not prove YouTube retention. [R1], [R4]
4. A case or experiment must disclose baseline, criterion, failure and limitations; do not generalize one result into a law.
5. For Shorts after 31.03.2025, analyze `Engaged views`, `Stayed to watch`, retention and average percentage viewed separately from public starts/replays. [O3], [O4]
6. A loop is an editorial option, not a known ranking requirement. Do not duplicate words or cut the payoff solely to force replay.
7. Misleading title/thumbnail promises are prohibited; every narrative gap must close with the promised answer. [O5]

## Sources

- [O1] YouTube Help, audience retention/key moments: https://support.google.com/youtube/answer/9314415
- [O2] YouTube, first 1–2 seconds of Shorts: https://blog.youtube/creator-and-artist-stories/youtube-creator-how-to-start/
- [O3] YouTube Help, Shorts analytics tips: https://support.google.com/youtube/answer/12942217
- [O4] YouTube Help, Shorts view-count change: https://support.google.com/youtube/answer/10059070
- [O5] YouTube Help, thumbnails policy: https://support.google.com/youtube/answer/9229980
- [C1] YouTube interview summary with Shorts creator Jenny Hoyos: https://blog.youtube/creator-and-artist-stories/youtube-shorts-deep-dive/
- [R1] Mayer et al., learner-controlled segmentation study: https://onlinelibrary.wiley.com/doi/abs/10.1002/acp.3560
- [R2] Kang et al. (2009), curiosity and memory: https://pubmed.ncbi.nlm.nih.gov/19619181/
- [R3] PACE curiosity framework: https://pmc.ncbi.nlm.nih.gov/articles/PMC6891259/
- [R4] Richter et al., signaling meta-analysis: https://www.sciencedirect.com/science/article/pii/S1747938X15000664
- [R5] Narrative transportation review: https://www.sciencedirect.com/science/article/abs/pii/S0065260124000145
