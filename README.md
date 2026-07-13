# tracker-spa

Factory's tracker frontend — scaffolded from
[`vite-react-typescript-template`](https://github.com/reneengels/vite-react-typescript-template).
React + TypeScript + Vite, with TailwindCSS, ESLint, i18n, Vitest, and TanStack Query already wired
up. The `/board` route is currently a placeholder — the real Board Kanban screen lands in ticket 01.

## Key Versions

| Package                | Version    |
|------------------------|------------|
| React                  | ^19.1.1    |
| Vite                   | ^7.1.2     |
| TypeScript             | ~5.8.3     |
| Vitest                 | ^3.2.4     |
| ESLint                 | ^9.33.0    |
| TailwindCSS            | ^4.1.13    |
| i18next                | ^25.5.2    |
| react-router           | ^7.8.2     |
| @tanstack/react-query  | ^5.90.2    |

## Features

- **React 19 + TypeScript**: Modern component development with type safety.
- **Vite**: Lightning-fast development with Hot Module Replacement (HMR).
- **TailwindCSS**: Utility-first CSS framework for rapid UI development.
- **ESLint**: Strict, type-based linting rules for clean code.
- **Internationalization (i18n)**: Example translations for multiple languages included.
- **TanStack Query**: `QueryClientProvider` configured at the app root, ready for the real API
  calls added in later tickets.
- **Vitest**: Test setup for components and pages included.
- **PostCSS & SCSS**: Modern styling options.
- **Well-structured project layout**: Easy to extend and collaborate in teams.

## Getting Started

1. **Clone the repository**
   ```bash
   git clone git@github.com:reneengels/tracker-spa.git
   cd tracker-spa
   ```
2. **Install dependencies**
   ```bash
   yarn install
   ```
3. **Start the development server**
   ```bash
   yarn dev
   ```
   Visit `http://localhost:5173` (Home) or `http://localhost:5173/board` (placeholder Board).
4. **Run tests**
   ```bash
   yarn test
   ```

## Useful yarn scripts

- `yarn dev` – Start development server
- `yarn build` – Build for production
- `yarn preview` – Preview production build
- `yarn lint` – Run ESLint
- `yarn test` – Run Vitest (fast, isolated, msw-mocked network — the bulk of this project's test coverage)
- `yarn test:e2e` – Run the E2E happy-path suite (see below)

## E2E testing (ticket 15)

A thin Playwright suite (`e2e/`) drives the full 10-status Scrumban happy path — Triagem → Backlog
→ Fila → Em Progresso → Review Agêntico → Review Humano → QA → Pronto — against the **real**
`tracker-api` (+ its MCP entrypoint) and a **real** test Postgres, combining actual human actions
(a real browser driving the real SPA) with actual agent actions (a real MCP client, via the
official `@modelcontextprotocol/sdk`, calling the real MCP server). No mocks anywhere in this
suite — that's deliberately what `yarn test`'s msw-backed page tests are for; they cover the large
majority of cases faster and in isolation. This suite exists specifically to prove `tracker-api`
and `tracker-spa` actually agree on the wire, end to end, at least once.

### Running it locally

```bash
yarn test:e2e
```

This single command (`e2e/run.sh`) does everything: brings up an isolated E2E stack (its own
Postgres, PgBouncer, `api`, `mcp` — distinct container names/ports from any dev stack you might
already have running, so both can coexist), seeds a bootstrap Admin user directly in the database
(there's no public registration endpoint), runs the actual Playwright suite, and tears the whole
stack down afterward regardless of outcome. Requires `tracker-api` checked out as a sibling
directory (`../tracker-api`, relative to this repo) — the same layout ticket 14's Nginx setup
already assumes — and Docker.

The test runner itself executes inside Microsoft's official Playwright Docker image
(`mcr.microsoft.com/playwright`), which bundles Chromium and its system dependencies. This was a
deliberate choice for this sandbox specifically (no root/apt access to install Chromium's shared
libraries directly, and Playwright's own `--with-deps` installer needs root too) — but it's also
just a reasonable, portable way to run this suite in CI without depending on the host's installed
browser dependencies at all.

### Two environment-specific quirks worked around (documented in `e2e/mcp-client.ts` in detail)

- Node's native `fetch` (undici) throws `UND_ERR_REQ_CONTENT_LENGTH_MISMATCH` specifically for a
  POST combining a body with a long `Authorization: Bearer <token>` header value — reproduced with
  zero application code involved (a bare `fetch()` call), on both the Playwright image's bundled
  Node 24 and a manually installed Node 22, so this is an upstream undici bug, not something this
  project can fix. Worked around with a small `fetch`-compatible shim backed by Node's `http`
  module, used only for the MCP client's own requests.
- FastMCP's Streamable HTTP transport has DNS-rebinding protection that only trusts
  `Host: localhost*` by default, rejecting the Docker-network hostname (`mcp:8001`) this client
  necessarily connects through with a 421. Worked around by presenting `Host: localhost:<port>`
  while still connecting to the real Docker hostname (HTTP explicitly allows these to differ — this
  isn't spoofing the connection target, just the header the DNS-rebinding check reads). This is an
  E2E-networking concern, not a `tracker-api` bug, but a real on-prem multi-host deployment could
  plausibly hit the same rejection — worth knowing about if the MCP server is ever reached through
  something other than `localhost` or a reverse proxy that already sets `Host` correctly (ticket
  14's Nginx setup does route through a proxy, so production deployments are not expected to hit
  this).

### CI shape

A CI pipeline for this suite would: check out `tracker-spa` and `tracker-api` as sibling
directories, ensure Docker is available, then run `yarn test:e2e` from `tracker-spa` — the same
single command used locally. No separate CI-specific configuration is needed beyond that checkout
layout.

## Best Practices & Extensions

### ESLint Configuration for Production (Advanced)

Use type-based rules for maximum code quality:

```js
export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
])
```

For React-specific rules:

```js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      reactX.configs['recommended-typescript'],
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
])
```

### Internationalization (i18n)

Sample translation files are included under `public/locales/`. Integration is handled via `src/i18n.tsx`.

### Tests

Component and page tests are located in `src/tests/` and can be run with Vitest.

---

**This template is the ideal foundation for your next React project – fast, robust, and extensible!**

For questions or suggestions, feel free to open an issue or submit a pull request.
