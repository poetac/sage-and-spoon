import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cspString } from './src/lib/csp.js'

// Inject the production CSP only into the built HTML (not dev, whose HMR needs
// inline/eval scripts a strict policy would block). GitHub Pages can't set
// response headers, so a <meta http-equiv> is how a static deploy ships a CSP.
const injectCsp = {
  name: 'inject-csp',
  apply: 'build',
  transformIndexHtml(html) {
    return html.replace('</title>', `</title>\n    <meta http-equiv="Content-Security-Policy" content="${cspString()}" />`)
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), injectCsp],
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
