// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    '@nuxtjs/color-mode',
    '@vueuse/nuxt',
    '@vite-pwa/nuxt',
    '@formkit/auto-animate/nuxt'
  ],
  devtools: { enabled: true },
  routeRules: {
    // todo
     '/api/halo': { proxy: 'https://example.com' },
  }
})