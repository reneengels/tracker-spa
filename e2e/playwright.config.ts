import { defineConfig, devices } from "@playwright/test";

// Ticket 15: real E2E happy-path suite. Runs inside the `playwright`
// service defined in e2e/docker-compose.e2e.yml — see that file for why
// (no sudo/apt access in this sandbox to install Chromium's system
// dependencies directly, so the official Playwright Docker image, which
// bundles them, runs the tests instead).
export default defineConfig({
    testDir: "./",
    testMatch: "*.spec.ts",
    timeout: 60_000,
    expect: { timeout: 15_000 },
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: [["list"]],
    use: {
        baseURL: "http://localhost:5173",
        trace: "retain-on-failure",
    },
    // Starts the SPA's own Vite dev server inside this same container —
    // its VITE_API_URL (a build-time-evaluated env var, ticket 14) points
    // at the `api` service by Docker DNS name, which resolves correctly
    // because the browser navigating to this dev server runs in this same
    // container, on the same Docker network as `api`/`mcp`.
    webServer: {
        command: "yarn dev --host 0.0.0.0 --port 5173",
        url: "http://localhost:5173",
        reuseExistingServer: false,
        timeout: 60_000,
        env: {
            VITE_API_URL: process.env.VITE_API_URL ?? "http://localhost:8000",
        },
    },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
