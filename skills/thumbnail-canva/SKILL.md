---
name: thumbnail-canva
description: Design thumbnails and generate AI image prompts for YouTube music channel covers. Use for thumbnail concepts, cover art, Canva layouts, and AI image generation prompts for YouTube Long or Shorts videos.
---

# Thumbnail Designer — AI Music Lab

## Контекст канала
- Канал: AI Music Lab (русскоязычная аудитория)
- Формат: talking-head видео + музыкальный трек
- Инструменты: Canva (дизайн) + AI-генератор изображений (фон/визуал)
- Стиль: спокойный, наблюдательный, личный

---

## ПРАВИЛО №1 — Принцип комплементарности
Текст на миниатюре НЕ повторяет название видео.
- Название: «5 треков которые я сделал за ночь»
- Миниатюра: «03:00. Не сплю.»

**Формулы текста на обложке:**
- Время + состояние: `03:00. Не сплю.`
- Число + факт: `47 попыток`
- Незаконченное действие: `Я просто нажал...`
- Провокация: `Это не музыкант`
- Вопрос без ответа: `Почему все плачут?`

**ЗАПРЕТ:** Никаких эмоциональных ярлыков («грустная», «эпичная») и жанровых описаний («неоклассика», «EDM»).

---

## ФАЗА 1: Определи тип миниатюры

### Тип A — Talking Head (Александр в кадре)
Используй когда: видео начинается с личной истории, есть сильная эмоция или реакция.

```
Композиция:
- Александр занимает 40-50% кадра (левая или правая треть)
- Взгляд направлен на зрителя или в сторону текста
- Сильное выражение лица: удивление / задумчивость / спокойная уверенность
- Текст на противоположной стороне — крупно, 2-4 слова
- Фон: размытый интерьер или градиент
```

### Тип B — Атмосферный визуал (без лица)
Используй когда: инструментальный трек, медитативная тема, ночная/дождливая атмосфера.

```
Композиция:
- Один сильный визуальный образ (окно с дождём, огонь свечи, ночной город)
- Текст поверх — крупно, с обводкой или на тёмной полосе
- Цвет: тёмная палитра с одним акцентом
```

### Тип C — Split / Контраст
Используй когда: есть сравнение, до/после, противопоставление.

```
Композиция:
- Левая половина: «до» (тёмная, десатурированная)
- Правая половина: «после» (яркая, насыщенная)
- Разделитель: вертикальная линия или градиент
- Одно слово на каждой стороне
```

---

## ФАЗА 2: Промпт для AI-генерации фона

### Шаблон промпта (универсальный)

```
YouTube thumbnail background image, [ОПИСАНИЕ СЦЕНЫ].
Mood: [НАСТРОЕНИЕ].
Color palette: [ЦВЕТА].
Style: cinematic, high contrast, professional photography.
No text, no people, no faces.
16:9 ratio, 1280x720px.
Leave [left/right] third empty for subject placement.
```

### Готовые промпты для AI Music Lab

**Ночная атмосфера / медитация / сон:**
```
YouTube thumbnail background. Rain on a dark window at night,
city lights blurred outside, single candle or lamp reflection.
Mood: melancholic, intimate, cinematic.
Color palette: deep blue, warm amber accent.
No text, no people. 16:9, 1280x720px.
```

**Этника / восточные инструменты:**
```
YouTube thumbnail background. Ancient desert landscape at golden hour,
subtle geometric ornamental patterns fading into background.
Mood: mystical, vast, timeless.
Color palette: warm gold, terracotta, deep shadow.
No text, no people. 16:9, 1280x720px.
```

**EDM / электронная / ритм:**
```
YouTube thumbnail background. Abstract sound waves or equalizer
visualization, neon light trails, dark studio atmosphere.
Mood: energetic, modern, pulsating.
Color palette: electric blue, magenta, deep black.
No text, no people. 16:9, 1280x720px.
Leave right third darker for text.
```

**Классика / хор / вокал:**
```
YouTube thumbnail background. Grand concert hall interior,
dramatic lighting from above, empty stage with spotlight.
Mood: majestic, emotional, epic.
Color palette: deep red, gold, warm white.
No text, no people. 16:9, 1280x720px.
```

**Личная история / talking head фон:**
```
YouTube thumbnail background. Blurred modern home interior,
warm evening light, bookshelf or window visible.
Mood: intimate, personal, calm.
Color palette: warm beige, soft brown, amber.
No text, no people. 16:9, 1280x720px.
Leave left third for subject placement.
```

---

## ФАЗА 3: Сборка в Canva

### Правила текста
- Максимум 4-5 слов
- Размер: 72-120pt для главного текста
- Всегда добавляй обводку (4-6px чёрная для светлого текста)
- Или: белый текст на полупрозрачной тёмной полосе

### Цветовые схемы для AI Music Lab

| Настроение | Фон | Текст | Акцент |
|-----------|-----|-------|--------|
| Ночь/грусть | #0D1B2A (тёмно-синий) | #FFFFFF | #C9A84C (золото) |
| Энергия/EDM | #0A0A0A (чёрный) | #00D4FF (циан) | #FF006E (маджента) |
| Тепло/душа | #1A0A00 (тёмно-коричневый) | #FFD700 (золото) | #FF6B35 (оранжевый) |
| Эпик/хор | #1A0000 (тёмно-красный) | #FFFFFF | #C9A84C (золото) |
| Спокойствие | #F5F0E8 (бежевый) | #2C2C2C (тёмный) | #8B7355 (коричневый) |

### Чеклист перед публикацией
- [ ] При размере 120x68px (превью) текст читается
- [ ] За 3 секунды понятно о чём видео
- [ ] Текст НЕ повторяет название
- [ ] Максимум 3 элемента (фон + лицо/визуал + текст)
- [ ] Проверено на тёмном и светлом экране

---

## ФОРМАТ ВЫВОДА

Когда Александр даёт трек или тему — выдать:

```
ТИП: [A / B / C]

ТЕКСТ НА ОБЛОЖКЕ: «[2-4 слова]»

ПРОМПТ ДЛЯ ФОНА:
[готовый промпт на английском]

СБОРКА В CANVA:
- Расположение элементов: [описание]
- Цветовая схема: [из таблицы]
- Размер текста: [размер]
- Обводка/полоса: [параметры]

АЛЬТЕРНАТИВНЫЙ ВАРИАНТ:
[второй концепт с другим типом]
```
