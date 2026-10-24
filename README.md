# Quoteblaze

Quoteblaze is a multi-tenant, AI-assisted quoting web application for small groundworks and landscaping contractors. Users paste a customer enquiry, review the extracted job details, and create an itemised draft quote using that company’s own rate catalogue. The AI assists with extraction and rate suggestions; deterministic application code validates rates and calculates totals. **An authorised person must review and approve every quote. The current version of Quoteblaze does not send customer emails.**

- [Quoteblaze](#quoteblaze)
  - [Features](#features)
  - [Tech stack](#tech-stack)
  - [Model choice](#model-choice)
  - [Project Structure](#project-structure)
  - [Working](#working)
  - [Development](#development)
    - [Prerequisites](#prerequisites)
    - [Setup](#setup)
      - [1. Clone the project's repository](#1-clone-the-projects-repository)
      - [2. Install dependencies](#2-install-dependencies)
      - [3. Configure local environment variables](#3-configure-local-environment-variables)
      - [4. Start PostgreSQL, migrate, and seed](#4-start-postgresql-migrate-and-seed)
      - [5. Start the web application](#5-start-the-web-application)
      - [6. Run checks and browser tests](#6-run-checks-and-browser-tests)
      - [To run the project using Docker](#to-run-the-project-using-docker)

## Features

- **Multi-company workspaces**: company records, users, customers, rates, quotes, settings, and AI credentials are scoped by tenant.
- **Email/password authentication**: session cookies are HTTP-only, and passwords are hashed before storage.
- **Customer directory**: search and reuse customer records while preserving potential duplicates for human review.
- **CSV import and rate review**: import customer and rate data while retaining source rows, notes, duplicates, uncertain values, and review status.
- **Configurable OpenRouter models**: each company enters its own OpenRouter API key and can select a compatible model by searching the model catalogue or entering a model ID. `openrouter/free` is only the default fallback, not a model restriction.
- **AI-assisted enquiry analysis**: extracts candidate work items, measurements, missing information, assumptions, unsupported work, and site-visit reasons from pasted customer text.
- **Deterministic pricing**: validates rate status and units, converts supported measurements, calculates line totals, applies the configured minimum charge and VAT policy, and blocks unresolved pricing.
- **Human review and approval**: quotes can be edited and recalculated. Approval requires permission and no blocking validation issues; approved revisions are immutable.
- **Safety guardrails**: large or complex jobs can require a site visit; unsupported work and unreviewed or unpriced rates are not treated as confirmed prices. Instructions embedded in customer emails cannot grant discounts or approve quotes.
- **Audit trail**: records key actions such as quote edits, pricing changes, credential changes, and approval events without logging API key plaintext.
- **Responsive Tailwind UI**: includes dashboard, customers, enquiries, rates, quote review, company settings, favicon, and show/hide controls for sensitive form inputs.
- **Automated checks**: Vitest covers domain and schema logic and Playwright covers browser workflows.

## Tech stack

- **Web**: Next.js, TypeScript, Tailwind CSS
- **ORM**: Drizzle ORM
- **Database**: PostgreSQL
- **AI**: OpenRouter
- **Validation**: Zod
- **Testing**: Vitest for unit/domain/integration tests, Playwright in `packages/e2e-tests`
- **Tooling**: pnpm, Turborepo, Biome, Docker, Docker Compose
- **Deployment**: [Vercel](https://vercel.com) (Web) and [Neon](https://neon.com) (Database)

## Model choice

Each company supplies its own **OpenRouter API key** in Settings. The selected model is a company-level setting, not a deployment constant. The default is `openrouter/free` for convenience, but administrators can enter any valid OpenRouter text chat model ID (for example `anthropic/claude-sonnet-4`, `openai/gpt-4o`, or a supported `:free` variant), or search the OpenRouter model catalogue in Settings and select one. The exact model ID is validated by sending a small connection-test prompt before saving. Availability, provider support, cost, output quality, and rate limits vary by model.

The model catalogue proxy uses the current company's OpenRouter key and returns only model metadata needed by the UI. A newly entered key is used ephemerally for catalogue search and is not stored unless Save succeeds. Existing companies can change the model while leaving the key field blank. Keys are encrypted at rest and never returned to the browser after saving. Use an **OpenRouter API key**, not a direct Anthropic/OpenAI provider key. See [OpenRouter's chat completions API](https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request?explorer=true) and [model catalogue API](https://openrouter.ai/docs/api/api-reference/models/get-models).

## Project Structure

The repository is organised by application and reusable package. Within the web app, code is grouped by feature where applicable.

```text
quoteblaze/
├── apps/
│   └── web/
│       └── src/
│           ├── app/                 # Pages, layouts, API route handlers, favicon
│           ├── components/ui/       # Reusable UI controls
│           ├── features/
│           │   ├── ai-analysis/     # OpenRouter request and validated analysis
│           │   ├── auth/            # Authentication-related UI
│           │   ├── company-settings/
│           │   ├── customers/
│           │   ├── enquiries/
│           │   ├── quoting/          # Quote workflow and domain orchestration
│           │   ├── rate-catalog/
│           │   └── tenants/         # Workspace layout and tenant context UI
│           └── lib/
│               ├── auth/            # Session and access control
│               ├── db/              # Web app database client
│               └── security/        # API credential encryption
├── packages/
│   ├── constants/                   # Shared constants
│   ├── database/
│   │   ├── migrations/              # Numbered SQL migrations
│   │   ├── src/                     # Table schema, relations, migrations, seed script
│   │   └── test/                    # Database integration tests
│   ├── e2e-tests/                   # Playwright tests and configuration
│   ├── pricing-engine/              # Deterministic pricing and quoteability rules
│   ├── schemas/                     # Shared Zod schemas
│   ├── tsconfig/                    # Shared TypeScript configurations
│   └── types/                       # Shared TypeScript types
├── seed-data/                       # Three example enquiries and some demo data
├── .github/workflows/               # CI/CD workflows
├── Dockerfile
├── docker-compose.yml
├── biome.json
├── lint-staged.config.mjs
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

Database table definitions belong in the database schema file; Drizzle relation metadata is kept separately in `relations.ts`. Relation-only changes do not require SQL migrations. When changing actual tables, columns, indexes, or constraints, update the schema and add a numbered SQL migration.

## Working

1. **Sign in to a company workspace**  
    The demo seed creates two separate companies. Each account has access only to its own company’s data. The server derives company scope from the authenticated membership rather than trusting a company ID supplied by the browser.

2. **Configure the company's AI model**  
    An owner or administrator opens *Settings → AI configuration*, enters that company’s OpenRouter API key, and chooses a model. They may search the OpenRouter catalogue or enter an exact model ID, then test the configuration before saving. The key is encrypted at rest using AES-256-GCM and is never returned to the browser after it has been saved.

    Use an OpenRouter API key, not a direct Anthropic or OpenAI provider key. The `OPENROUTER_DEFAULT_MODEL` environment variable is only a fallback, the model selected in company settings takes precedence. Model availability, price, rate limits, and feature support depend on the selected model and provider.

3. **Paste an enquiry and review the analysis**  
    Paste the customer’s email into the Enquiries workflow. Quoteblaze stores the original text and asks the configured model to return structured job information, including candidate rate codes, quantities, uncertainties, and scope details. The model's response is validated against the shared schema. Email text is treated as untrusted content; embedded instructions cannot change company settings, rates, discounts, or approval state.

    Customer matching is a suggestion rather than an automatic merge. If the contact is ambiguous or appears to match multiple records, the user should check the details before proceeding.

4. **Generate and review a quote**  
    The pricing engine—not the model—validates rate eligibility and performs money calculations. It applies configured minimum-charge and VAT rules and uses company-owned rates only. Rates with missing values, uncertain tax treatment, or a review-required status cannot be silently treated as confirmed pricing.

    Depending on the enquiry, the result can be a draft for review, a blocked quote requiring information or rate review, an unsupported-work result, or a site-visit recommendation. A large commercial car park, for example, should not receive a complete automated quote simply because the email asks for a ballpark number.

5. **Approve explicitly**  
    A permitted reviewer checks the line items, assumptions, exclusions, warnings, taxes, and totals before approving the current revision. A quote with blocking issues cannot be approved. Once approved, that revision is immutable, an edit creates a new revision and requires approval again. *Approval is an internal record only: no email is sent to the customer.*

6. **Tenant isolation and credential safety**
    Business records are scoped by company and protected by server-side membership checks. The database uses company-scoped relationships and constraints where appropriate. Do not add shared AI credentials to public environment variables, expose secrets through `NEXT_PUBLIC_*`, or use real production credentials for CI tests.

## Development

### Prerequisites

- Node.js (preferably, version >= v24.x)
- PostgreSQL (preferably, version >= v18.x)
- pnpm (preferably, version >= v12.5.1)
- OpenRouter account
- OpenSSL (or another secure random generator)
- Docker (preferably the latest version)
- Git (preferably the latest version)

### Setup

#### 1. Clone the project's repository

   ```shell
   git clone https://github.com/rajatyadav01/quoteblaze.git
   ```

#### 2. Install dependencies

Run commands from the repository root:

```shell
pnpm install
```

#### 3. Configure local environment variables

Copy the example file to `.env` at the repository root:

```shell
cp .env.example .env
```

Generate unique local secret values:

```shell
openssl rand -hex 32       # AUTH_SECRET: at least 32 characters
openssl rand -base64 32    # APP_ENCRYPTION_KEY: exactly 32 decoded bytes
```

Replace the placeholder values in `.env`. The root-level `.env` is loaded by the web app's Next.js configuration for local development and by the database migration/seed scripts. `.env` is ignored by Git.

Keep these values in the `.env` server-side and never prefix secrets with `NEXT_PUBLIC_`. The `APP_ENCRYPTION_KEY` must remain stable across deployed instances. Replacing it without re-encrypting stored credentials will make existing company keys unreadable. Use the same value for all instances that need to decrypt the same database credentials.

**Do not set one shared `OPENROUTER_API_KEY` in `.env`.** Each company should be configured separately through Settings. The web app does not expect a global OpenRouter key environment variable.

#### 4. Start PostgreSQL, migrate, and seed

```shell
pnpm db:migrate
pnpm db:seed
```

The migration creates the database schema. The seed script creates the demo companies and accounts. The CI workflow seeds only its disposable PostgreSQL service for automated tests. Seeding is intended for development and test environments; **do not run the demo seed against a production customer database**. The seed script refuses to run when `NODE_ENV=production` unless `ALLOW_DEMO_SEED=true` is explicitly set for an isolated demo database.

#### 5. Start the web application

```shell
pnpm dev:web
```

Open [http://localhost:3000](http://localhost:3000).

#### 6. Run checks and browser tests

Common commands:

```shell
pnpm format                 # Format files with Biome
pnpm lint                   # Run Biome lint checks
pnpm typecheck              # TypeScript checks across the workspace
pnpm test                   # Run all workspace tests through Turborepo
pnpm test:unit              # Run only the unit tests
pnpm test:integration       # Run only the integration tests
pnpm test:e2e               # Run Playwright browser tests
```

Before the E2E tests run, ensure the local database has been migrated and seeded. By default, Playwright starts the web app itself. To test an already running application, set `QUOTEBLAZE_E2E_BASE_URL`; see `packages/e2e-tests/playwright.config.ts`. Demo credentials can be overridden using `QUOTEBLAZE_HOLLIS_EMAIL`, `QUOTEBLAZE_HOLLIS_PASSWORD`, `QUOTEBLAZE_GREENFIELD_EMAIL`, and `QUOTEBLAZE_GREENFIELD_PASSWORD`.

#### To run the project using Docker

1. Clone the project's repository.

   ```shell
   git clone https://github.com/rajatyadav01/quoteblaze.git
   ```

2. Go to the project folder using the CLI.

   ```shell
   cd quoteblaze
   ```

3. Run the project using docker-compose.

   ```shell
   docker-compose up --build
   ```

4. After all the containers have been started, open any browser and go to `http://localhost3001` to access the web application.
