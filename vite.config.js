import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',           // index.html のある場所
  base: './',          // 相対パスで出力する場合
  build: {
    outDir: 'dist',    // ビルド成果物のディレクトリ
    sourcemap: false,  // 必要に応じて true に
    minify: 'esbuild', // デフォルトで有効
  },
});
