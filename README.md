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
- `yarn test` – Run Vitest

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
