import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';

const source = (name: string) => fileURLToPath(new URL(`./src/${name}`, import.meta.url));

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: {
        'enchantforge-vue': source('index.ts'),
        core: source('core.ts'),
        enchant: source('enchant.ts'),
        aura: source('aura.ts'),
        debug: source('debug.ts'),
        otel: source('otel.ts')
      },
      formats: ['es'],
      cssFileName: 'enchantforge-vue',
      fileName: (_format, entryName) => `${entryName}.js`
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js'
      }
    }
  }
});
