# Contributing

## Dev setup

- Requirements: Node 18+, Docker (optional), PostgreSQL 15+ with pgvector, Redis
- Install: `npm install`
- DB: `npm run db:push` (dev) or use migrations in prod
- Run: `npm run dev` (monorepo via turbo)

## Env

Copy `.env.example` → `.env` and fill:
- BOT/API/Mini App: tokens and URLs
- Providers (optional): AVITO_*, CIAN_SOURCE_*, YANDEX_SOURCE_*, DOMCLICK_SOURCE_*
- Offers: MORTGAGE_OFFER_URL, INSURANCE_OFFER_URL, LEGAL_CHECK_OFFER_URL, RENT_PARTNER_OFFER_URL
- Enrichment keys: YANDEX_MAPS_API_KEY / DGIS_API_KEY

## Tests

- Unit/Integration: `npx turbo run test`
- Add tests in corresponding package `src/**/*.test.ts`

## Commit style

- Scope per package/app where possible
- Keep README and .env.example in sync with changes

## CI

- GitHub Actions runs lint/build/tests on PRs
- Prisma client generated before build

## Release/Deploy

- Use Docker compose for all services locally
- For prod: use migrations, secrets manager for env, logging/metrics, and rate limits