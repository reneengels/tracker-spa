import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    test: {
        environment: 'jsdom',
        setupFiles: './test-setup.ts',
        globals: true,
        // e2e/ holds the Playwright suite (ticket 15, run via `yarn test:e2e`,
        // not Vitest) — its *.spec.ts files aren't Vitest tests and don't run
        // in this environment (no browser, no live backend). Extend the
        // defaults rather than replace them (a bare override would stop
        // excluding node_modules/dist/etc.).
        exclude: [...configDefaults.exclude, '**/e2e/**'],
    },
})