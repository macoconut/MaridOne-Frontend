# MaridOne Frontend

The React frontend for MaridOne, an HR, attendance, and payroll management system. It provides separate portals for employees, HR staff, managers, accounting, and management, with shared employee self-service screens.

The API lives in the [MaridOne backend repository](https://github.com/King-Arturito/MaridOne).

## Features

| Portal | Main workflows |
| --- | --- |
| Employee self-service | Personal dashboard, attendance records, timecards, leave and overtime requests, payslips, and document access |
| HR | Employee administration, attendance dashboard and reports, schedules, approvals, payslips, pay run reporting, and audit logs |
| Manager | Team attendance, monthly team schedules, and pending approvals |
| Accounting | Payroll dashboard and payroll review |
| Management | Attendance oversight, payroll costs, pay run reporting, and pending approvals |

Shared functionality includes notification polling, account security settings, two-factor authentication flows, sensitive-access prompts, confirmation dialogs, and responsive role layouts.

## Technology

- React 19 and TypeScript.
- Vite 7 for development and production builds.
- React Router 7 for routing and portal layouts.
- CSS styles and shared design tokens.
- Vitest, React Testing Library, and jsdom for tests.
- ESLint for linting.

Dependencies and scripts are defined in [package.json](package.json).

## Local setup

### Requirements

- Node.js 22.13 or newer within the Node 22 release line, or Node.js 24 or newer. This covers the Vite and jsdom requirements in the current lockfile.
- npm.
- A configured MaridOne backend and an account with the appropriate portal role.

### Install and run

```bash
git clone https://github.com/macoconut09/MaridOne-Frontend.git
cd MaridOne-Frontend
npm ci
```

Create `.env.local` in the repository root:

```dotenv
VITE_API_BASE_URL=http://localhost:8080
VITE_BACKEND_TEST_MODE=false
VITE_DOCUMENTS_MOCK_MODE=false
```

Then start the development server:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Set the backend's `URL_HOST` to this same origin so CORS and emailed links use the correct address.

### Environment settings

| Variable | Behavior |
| --- | --- |
| `VITE_API_BASE_URL` | Backend origin, without `/api`; endpoint modules append their own API paths |
| `VITE_BACKEND_TEST_MODE` | Enables the backend testing interface when set to `true` |
| `VITE_DOCUMENTS_MOCK_MODE` | Uses document samples for frontend design testing when set to `true` |

Both flags default to `false`. Document mock mode only substitutes document samples; normal portal workflows still need the backend.

Without an explicit API base URL, the app targets port `8080` on the current hostname when served on Vite ports `5173` or `4173`. On other ports it uses the current origin. Set `VITE_API_BASE_URL` explicitly when hosting the API separately.

Vite embeds these values into the client bundle at build time. Use them for public configuration and keep credentials on the backend. Restart the development server after changing environment files.

## Available commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check the project and create a production bundle in `dist/` |
| `npm run preview` | Preview the built bundle locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:ui` | Open the Vitest interface |

Tests cover shared API and account-security utilities, formatting, role layouts, modal state, attendance request forms, schedule helpers, employee filters, and payroll UI components.

## Project structure

```text
src/
  components/   Shared UI, account, document, and security components
  config/       Frontend configuration and feature flags
  context/      Shared React context
  hooks/        Reusable state and interaction hooks
  layouts/      Portal shells and role-specific layouts
  lib/
    api/        Shared API client, endpoint modules, and API types
    types/      Shared domain types
    utils/      Session, date, routing, formatting, and UI helpers
  pages/
    Public/     Landing page and email verification
    auth/       Login and password workflows
    self-service/
    hr/
    manager/
    accounting/
    management/
  styles/       Shared styling and design tokens
  test/         Test setup
docs/           Deployment documentation and AWS policy examples
```

## Backend integration

The shared API client attaches authentication tokens, coordinates token refresh, and handles expired sessions. Role-aware routing determines which portal screens to display; backend authorization controls access to API data and operations.

Use the [backend README](https://github.com/King-Arturito/MaridOne#readme) for database, storage, mail, and authentication configuration.

## Deployment

GitHub Actions installs dependencies, builds the frontend, uploads `dist/` to Amazon S3, and invalidates the CloudFront cache on pushes to `main` or manual workflow runs. The workflow supplies its own build-time environment settings.

For static hosting, configure a fallback to `index.html` so direct links to portal routes resolve correctly. See [frontend deployment documentation](docs/frontend-auto-deploy.md) for the configured infrastructure, OIDC setup, and policy examples.
