/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
  // Optimize production build
  corePlugins: {
    // Disable unused plugins
    preflight: true,
  },
  // Purge unused styles
  safelist: [],
}
