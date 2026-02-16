import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: [
        'fs',
        'path',
        'url',
        'os',
        'crypto',
        'robotjs',
        '@cherrystudio/mac-system-ocr',
        'node-mac-permissions',
        'node-screenshots',
      ],
    },
    target: 'node18',
    outDir: 'dist',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
