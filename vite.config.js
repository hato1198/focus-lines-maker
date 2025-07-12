import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',         // HTML のある場所に変更
  base: './',          // 相対パス
  build: {
    outDir: '../dist', // src/ から見た相対パスで dist に出力
    emptyOutDir: true,
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      input: {
        main: 'src/index.html',
        subpage: 'src/subpage.html'
      }
    }
  },
});