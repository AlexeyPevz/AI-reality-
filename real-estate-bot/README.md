# Real Estate Bot - умный бот для подбора недвижимости

MVP системы для интеллектуального подбора недвижимости с match-score алгоритмом, диалоговым интервью и фоновым мониторингом.

## Возможности

- 🏠 Адаптивное интервью для сбора предпочтений
- 📊 Расчет match-score (0-10) для каждого объекта
- 💡 Объяснение, почему объект подходит
- 🔔 Фоновый мониторинг новых объектов
- 📱 Mini App для детального просмотра
- 🧠 RAG-система базы знаний о недвижимости

## Структура проекта

```
real-estate-bot/
├── apps/
│   ├── bot/          # Telegram бот
│   ├── mini-app/     # Next.js Mini App
│   └── api/          # API сервер
├── packages/
│   ├── shared/       # Общие типы и утилиты
│   ├── database/     # Prisma схема и клиент
│   └── providers/    # Провайдеры данных
└── turbo.json        # Конфигурация monorepo
```

## Установка

### Требования

- Node.js 18+
- PostgreSQL 15+ с расширением pgvector
- Redis
- Telegram Bot Token

### Шаги установки

1. Клонируйте репозиторий:
```bash
git clone <repository-url>
cd real-estate-bot
```

2. Установите зависимости:
```bash
npm install
```

3. Настройте окружение:
```bash
cp .env.example .env
# Отредактируйте .env и добавьте ваши данные
```

4. Настройте базу данных:
```bash
# Создайте базу данных PostgreSQL
createdb realestate

# Установите расширение pgvector
psql -d realestate -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Примените миграции
npm run db:push
```

5. Запустите Redis:
```bash
redis-server
```

## Запуск

### Режим разработки

Запуск всех сервисов:
```bash
npm run dev
```

Или по отдельности:
```bash
# Бот
npm run dev --workspace=@real-estate-bot/bot

# Mini App
npm run dev --workspace=@real-estate-bot/mini-app

# API
npm run dev --workspace=@real-estate-bot/api
```

### Production

1. Соберите проект:
```bash
npm run build
```

2. Запустите:
```bash
npm run start
```

## Конфигурация

### Основные переменные окружения

- `BOT_TOKEN` - токен Telegram бота
- `DATABASE_URL` - строка подключения к PostgreSQL
- `REDIS_URL` - строка подключения к Redis
- `MINI_APP_URL` - URL Mini App для бота
- `API_URL` - URL API сервера

### Настройка бота в Telegram

1. Создайте бота через @BotFather
2. Установите команды:
```
/start - Начать работу с ботом
/search - Новый поиск
/queries - Мои запросы
/settings - Настройки
/help - Помощь
```
3. Настройте Mini App URL в настройках бота

## Архитектура

### Алгоритм match-score

1. **Сбор данных**: адаптивное интервью с калибровкой весов
2. **Нормализация**: приведение всех факторов к шкале 0-10
3. **Взвешенная сумма**: расчет итогового score
4. **Объяснение**: генерация понятного описания

### Факторы оценки

**Для жизни:**
- Транспортная доступность
- Близость школ/садов
- Парки и зеленые зоны
- Наличие парковки
- Уровень шума
- Экология района

**Для инвестиций:**
- Ликвидность
- Стадия строительства
- Инфраструктура района
- Потенциал роста цены

## API Провайдеры

Система поддерживает подключение различных источников данных:

- Mock Provider (для разработки)
- CIAN API (требует ключ)
- Партнерские агрегаторы

## Разработка

### LLM Integration via OpenRouter

Бот использует OpenRouter для доступа к множеству LLM моделей:

1. Получите API ключ на [OpenRouter](https://openrouter.ai/)

2. Настройте в `.env`:
```bash
OPENROUTER_API_KEY=sk-or-v1-your_key
LLM_PRESET=balanced  # Опции: premium, balanced, economy, russian
```

3. Доступные модели:
- **OpenAI**: GPT-4, GPT-3.5-turbo
- **Anthropic**: Claude 3 (Opus, Sonnet, Haiku)
- **Google**: Gemini Pro, PaLM
- **Meta**: Llama 3
- **Mistral**: Mixtral, Mistral
- И многие другие!

4. Тестирование моделей:
```bash
# В чате бота
/experiment
```

5. Пресеты оптимизированы для разных сценариев:
- **Premium**: Лучшее качество, высокая цена
- **Balanced**: Баланс качества и цены
- **Economy**: Минимальная стоимость
- **Russian**: Оптимизирован для русского языка

### Добавление нового провайдера

1. Создайте класс в `packages/providers/src/`
2. Наследуйте от `BaseListingsProvider`
3. Реализуйте методы `searchListings` и `getListing`
4. Зарегистрируйте в `ProviderFactory`

### Добавление новых факторов оценки

1. Добавьте в типы `PreferenceWeights` и `MatchBreakdown`
2. Реализуйте расчет в `calculateBreakdown`
3. Добавьте вопросы в интервью
4. Обновите описания в `getFactorDescription`

## Провайдеры-источники и агрегатор

Система поддерживает одновременное подключение нескольких источников объектов (через прокси/API), объединение выдачи и устранение дублей:
- Источники (через .env):
  - Avito: `AVITO_BASE_URL`, `AVITO_API_KEY`
  - CIAN Source: `CIAN_SOURCE_BASE_URL`, `CIAN_SOURCE_API_KEY`
  - Yandex Source: `YANDEX_SOURCE_BASE_URL`, `YANDEX_SOURCE_API_KEY`
  - DomClick Source: `DOMCLICK_SOURCE_BASE_URL`, `DOMCLICK_SOURCE_API_KEY`
- Агрегатор собирает выдачу от всех активных источников и выполняет дедупликацию:
  - Гео‑бакетизация (~500м) + нормализация адреса/названия/комнат/площади
  - Выбор лучшего дубликата по фото/описанию/цене
- Включение источника = просто задать ключи в `.env` (перезапуск не обязателен в dev)

## Покупка/аренда, первичка/вторичка

Интервью и предпочтения поддерживают:
- `dealType`: покупка (`sale`) или аренда (`rent`)
- `propertyType`: первичка (`new`), вторичка (`secondary`) или `any`
- Для аренды — дополнительные поля: срок (short/long), мебель, питомцы, коммуналка, залог

Все поля сохраняются в `Preferences` и участвуют в запросах к провайдерам и скоринге.

## Офферы (монетизация)

Ненавязчивые офферы отображаются в боте и Mini App и ведут на ваш партнерский URL через бэкенд‑редирект с UTM и логированием клика:
- Переменные окружения:
  - `MORTGAGE_OFFER_URL`, `INSURANCE_OFFER_URL`, `LEGAL_CHECK_OFFER_URL`, `RENT_PARTNER_OFFER_URL`
- Эндпоинт редиректа: `GET /api/offers/redirect?type=mortgage|insurance|legal|rent&listingId=...&uid=...`
- В боте доступна команда `/offers`

## Метрики и админ-доступ

- `GET /api/analytics/metrics` — сводная статистика (требуется Telegram init-data, доступ только для `ADMIN_IDS`)
- Mini App: страница `/admin/metrics` проксирует метрики с пробросом init-data
- Переменная окружения: `ADMIN_IDS=123,456`

## Обогащение и квоты

- Обогащение факторов (школы/парки/метро) через Yandex/2GIS/Overpass
- Кэш: `ListingEnrichment` на период `ENRICHMENT_CACHE_DAYS`
- Ограничение RPS: `ENRICHMENT_RPM` (по умолчанию 60)

## Переменные окружения (ключевые)

Смотри полный список в `.env.example`. Основные группы:
- Бот/API/Mini App: `BOT_TOKEN`, `API_URL`, `MINI_APP_URL`, `CORS_ORIGIN`
- БД/Redis: `DATABASE_URL`, `REDIS_URL`
- Провайдеры-источники: `AVITO_*`, `CIAN_SOURCE_*`, `YANDEX_SOURCE_*`, `DOMCLICK_SOURCE_*`
- Офферы: `MORTGAGE_OFFER_URL`, `INSURANCE_OFFER_URL`, `LEGAL_CHECK_OFFER_URL`, `RENT_PARTNER_OFFER_URL`
- Обогащение: `YANDEX_MAPS_API_KEY`, `DGIS_API_KEY`, `OVERPASS_API_URL`, `ENRICHMENT_CACHE_DAYS`, `ENRICHMENT_RPM`
- Админ: `ADMIN_IDS`

## Тестирование и CI

- Юнит/интеграционные тесты:
  ```bash
  npx turbo run test
  ```
- CI (GitHub Actions): build + lint + test, Prisma generate

## API (выдержка)

- `GET /health` — здоровье
- `POST /api/search` — поиск по preferencesId (Telegram auth)
- `GET /api/listings/:id` — объект по id
- `GET /api/analytics/metrics` — метрики (админ)
- `GET /api/offers/redirect` — редирект на оффер (лог клика)

## Roadmap (обновлено)

- [ ] Подключение реальных источников (CIAN/Яндекс/ДомКлик) и расширенный маппинг полей
- [ ] Ещё факторы скоринга (шум/экология из внешних источников), A/B промптов
- [ ] Постбеки партнёров, антифрод кликов/лидов
- [ ] E2E и нагрузочное тестирование, миграции вместо db:push
- [ ] Продакшн‑наблюдаемость (логи, метрики, алерты) и политика доступа

## Лицензия

MIT

## Обогащение факторов (реальные данные)

- Используются источники:
  - Yandex Maps Search API (при наличии `YANDEX_MAPS_API_KEY`)
  - 2GIS Catalog API (при наличии `DGIS_API_KEY`)
  - Overpass (OSM) как фоллбэк (`OVERPASS_API_URL`)
- Факторы: школы, парки, метро (действительные расстояния), производные: шум/экология.
- Кэшируется в БД моделью `ListingEnrichment` на `ENRICHMENT_CACHE_DAYS`.

Переменные окружения:
- `YANDEX_MAPS_API_KEY`, `DGIS_API_KEY`, `OVERPASS_API_URL`, `ENRICHMENT_CACHE_DAYS`