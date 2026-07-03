# Hook patterns

## Содержание

- [Карта выбора](#карта-выбора)
- [Шаблоны](#шаблоны)
- [Guardrails](#guardrails)
- [Sources](#sources)

## Карта выбора

| Задача | Выбрать | Проверить |
|---|---|---|
| Пошаговый tutorial | H02 promise, H03 cold open, H04 result-first | Результат реально достижим на показанных условиях |
| Объяснение механизма | H01 question, H06 contradiction, H14 bounded gap | Ответ не задерживается искусственно |
| Исправление ошибки | H05 problem, H08 mistake→replacement, H09 diagnostic | Ошибка распространена и доказуема |
| Сравнение | H11 proof-first, H12 A/B | Один критерий, одинаковые условия |
| Кейс/история | H04 payoff-first, H13 story-in-progress | История быстро возвращается к пользе |
| Сложный long-form | H02 promise + H10 roadmap | Roadmap занимает одну фразу |
| Shorts | H15 visual anomaly, H16 shock→intrigue→satisfy | Первый кадр понятен без звука; payoff быстрый |

## Шаблоны

### H01. Ограниченный вопрос

- template: `Почему/как [конкретный наблюдаемый эффект], хотя [знакомое ожидание]?`
- use: explainer, причина, научная или AI-тема.
- avoid: риторический, слишком общий или очевидный вопрос.
- example: «Почему Suno сохраняет мелодию куплета, но ломает ее в припеве?»
- evidence: official example + research-compatible; [O1], [R1].

### H02. Ясное обещание

- template: `За [реалистичное время] вы [проверяемый результат] без/с [важное условие].`
- use: tutorial, настройка, workflow.
- avoid: скрытые prerequisites, гарантии результата вне контроля автора.
- example: «За 8 минут соберем RAG-бота, отвечающего по вашим PDF».
- evidence: official; [O1], [O2].

### H03. Cold open

- template: `[действие/демо] → «Сейчас покажу, какие [N] решения это обеспечили»`.
- use: код, музыка, инструмент, эксперимент.
- avoid: непонятное действие без немедленного контекста.
- example: Агент исправляет failing test → «Вот три правила, которые не дали ему сломать остальной код».
- evidence: official example; [O1].

### H04. Payoff first

- template: `«Вот результат до/после. Теперь разберем [конкретный механизм]»`.
- use: transformation, звук, дизайн, оптимизация.
- avoid: если после reveal не остается объясняющей ценности.
- example: Проиграть mix до/после → показать одну измененную цепочку.
- evidence: official retention guidance; [O2].

### H05. Узнаваемая проблема

- template: `«Если у вас [симптом], вероятная причина — [ограниченная категория], а не [ложная интуиция]»`.
- use: troubleshooting, workflow.
- avoid: надуманная боль, запугивание, универсальный диагноз.
- example: «Если Claude забывает формат, проверьте два места инструкции, а не меняйте модель».
- evidence: hypothesis grounded in expectation match; [O2].

### H06. Проверяемое противоречие

- template: `«[Популярное ожидание] не всегда дает [результат]. Вот контрпример и механизм»`.
- use: myth, data explainer, debugging.
- avoid: игра слов, cherry-picking, контрарность ради реакции.
- example: «Больше jump cuts не обязательно делает урок динамичнее».
- evidence: research-compatible hypothesis; [R1], [R2].

### H07. Конкретная ставка

- template: `«Из-за [решение] вы можете потерять/сэкономить [измеримое последствие]»`.
- use: стоимость API, время, безопасность, качество.
- avoid: искусственная катастрофизация.
- example: «Эта настройка удваивает стоимость запросов без заметного прироста качества».
- evidence: research-compatible; [R2].

### H08. Ошибка → замена

- template: `«Не [конкретная ошибка]. Вместо этого [точное действие] — покажу разницу»`.
- use: beginner tutorial, prompt, code, editing.
- avoid: редкая/спорная ошибка без proof.
- example: «Не просите AI “сделать красиво”; задайте три измеримых ограничения».
- evidence: hypothesis; [O2].

### H09. Мини-диагностика

- template: `«Если [тест A] — причина X; если [тест B] — причина Y»`.
- use: ветвящиеся проблемы.
- avoid: неточный тест; high-stakes диагноз без специалиста.
- example: «Задержка растет только в длинном чате — проверьте context; с первого ответа — endpoint».
- evidence: hypothesis with indirect self-reference research; [R3].

### H10. Превью маршрута

- template: `«Сначала [A], затем [B], в конце проверим [C]»`.
- use: сложный lesson 8–20 минут.
- avoid: короткое видео; длинное оглавление.
- example: «Выберем модель, подключим знания, затем проверим на трех запросах».
- evidence: learning research, not YouTube-retention proof; [R4].

### H11. Proof before claim

- template: `[измеримый артефакт] → «Разберем, какое изменение дало эту разницу»`.
- use: benchmark, case study, code, audio.
- avoid: unverifiable data, слабая выборка, metric mismatch.
- example: «41 корректный JSON из 50 против 27 — вот измененная инструкция».
- evidence: hypothesis + official guidance to move compelling moments earlier; [O2].

### H12. A/B с критерием

- template: `«A и B на одном [input]. Победитель — по [один критерий]»`.
- use: tools, models, prompts, audio.
- avoid: разные условия, плавающие критерии, скрытая реклама.
- example: «Две модели на одной schema; сравниваем только valid JSON rate».
- evidence: hypothesis; [O2].

### H13. История уже началась

- template: `«На [момент] случилось [сбой/выбор]. Причина оказалась [обещание раскрытия]»`.
- use: experiment, case, investigation.
- avoid: длинная биография или экспозиция до пользы.
- example: «На третьем запуске агент удалил таблицу. Я дал ему одно лишнее разрешение».
- evidence: general narrative research, not direct YouTube test; [R5].

### H14. Ограниченная незавершенность

- template: `«A и B решили [часть], но создали [точный остаток]. Шаг C закроет его»`.
- use: process, causal investigation.
- avoid: туманный open loop или задержка уже нужного ответа.
- example: «Шум ушел, но голос стал тонким; третий фильтр вернет плотность».
- evidence: curiosity research; [R1], [R6].

### H15. Visual anomaly + context (Shorts)

- template: `[необычный релевантный кадр] + [короткая подпись, объясняющая ставку]`.
- use: interface, transformation, waveform, physical demo.
- avoid: unrelated shock image, нечитаемый текст.
- example: Семь ручных шагов схлопываются в один workflow; подпись «Агент заменил цепочку».
- evidence: official general advice for first 1–2 seconds; exact formula is a hypothesis; [O3].

### H16. Shock → intrigue → satisfy (Shorts)

- template: `[яркий релевантный beat] → [одна интрига] → [быстрый ответ/исправление]`.
- use: mini-story, experiment, visible failure.
- avoid: ложный shock, крик, опасное действие, withheld payoff.
- example: «AI стер барабаны» → причина в stem name → переименование → восстановленный mix.
- evidence: creator practice, not ranking rule; [C1].

## Guardrails

1. Подтвердить title/thumbnail в первые 30 секунд long-form; intro-retention — диагностический сигнал, не универсальная оценка качества. [O2]
2. Не обещать кадр, результат или событие, которого нет в видео; misleading thumbnails запрещены. [O4]
3. Не путать любопытство с туманностью: зритель должен понимать, какой ответ получит. [R1], [R6]
4. Не копировать «идеальную длину» хука: YouTube ее не задает. Экспериментировать на сходных роликах и читать dips/spikes/top moments. [O2]
5. Для Shorts после 31.03.2025 отделять public starts/replays от `Engaged views`, `Stayed to watch`, retention и average percentage viewed. [O5], [O6]
6. Менять за тест одну основную переменную; не объявлять победителя при смене одновременно темы, упаковки, длительности и hook.

## Sources

- [O1] YouTube, «Four tips to hook your viewers»: https://blog.youtube/creator-and-artist-stories/four-tips-to-hook-your-viewers-on/
- [O2] YouTube Help, audience retention/key moments: https://support.google.com/youtube/answer/9314415
- [O3] YouTube, creator getting started/first 1–2 seconds of Shorts: https://blog.youtube/creator-and-artist-stories/youtube-creator-how-to-start/
- [O4] YouTube Help, thumbnails policy: https://support.google.com/youtube/answer/9229980
- [O5] YouTube Help, Shorts view-count change: https://support.google.com/youtube/answer/10059070
- [O6] YouTube Help, content performance metrics: https://support.google.com/youtube/answer/12220281
- [C1] YouTube interview summary with Shorts creator Jenny Hoyos: https://blog.youtube/creator-and-artist-stories/youtube-shorts-deep-dive/
- [R1] Kang et al. (2009), curiosity and memory: https://pubmed.ncbi.nlm.nih.gov/19619181/
- [R2] Psychological Research, curiosity/confidence/importance replication: https://link.springer.com/article/10.1007/s00426-023-01841-9
- [R3] Tchernev et al., dynamic narrative transportation: https://journals.sagepub.com/doi/10.1177/00936502211018577
- [R4] Richter et al., signaling meta-analysis: https://www.sciencedirect.com/science/article/pii/S1747938X15000664
- [R5] van Laer et al., narrative transportation review: https://www.sciencedirect.com/science/article/abs/pii/S0065260124000145
- [R6] Gruber & Ranganath, PACE curiosity framework: https://pmc.ncbi.nlm.nih.gov/articles/PMC6891259/
