// Playwright config for learn67 smoke tests.
// Serves the repo root (index.html lives there) on :8080.
module.exports = {
  testDir: "./tests",
  testMatch: "smoke.spec.js",
  timeout: 30000,
  use: { baseURL: "http://localhost:8080", headless: true },
  webServer: {
    command: "python3 -m http.server 8080 --directory .",
    port: 8080,
    reuseExistingServer: true,
  },
};
