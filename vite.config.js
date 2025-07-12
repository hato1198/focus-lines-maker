import { defineConfig } from 'vite';
import { resolve } from 'path';
import { vitePluginHtmlMinifierTerser } from 'vite-plugin-html-minifier-terser';

export default defineConfig({
  root: 'src',
  base: '/',
  plugins: [
    vitePluginHtmlMinifierTerser()
  ],
  build: {
    outDir: '../dist', // src/ から見た相対パスで dist に出力
    emptyOutDir: true,
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
        faq: resolve(__dirname, 'src/faq.html'),
        terms: resolve(__dirname, 'src/terms.html'),
        privacy: resolve(__dirname, 'src/privacy.html'),
        contact: resolve(__dirname, 'src/contact.html'),
      }
    }
  },
});