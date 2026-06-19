import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html'],
      include: ['src/**/*.{js,jsx}'],
      // Exclude tests, the entrypoint, and the large generated data files (which
      // are integrity-checked by coverage.test.js, not unit-covered).
      exclude: ['src/**/*.test.{js,jsx}', 'src/main.jsx', 'src/test/**', 'src/data/generated-meals.js', 'src/data/recipe-images.js'],
      // Lenient floors that ratchet against a big coverage drop, not a quality bar
      // (current ~74–77%). Raise as coverage grows.
      thresholds: { lines: 68, functions: 68, branches: 68, statements: 68 },
    },
  },
})
