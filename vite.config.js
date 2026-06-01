import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      'three/addons/': 'three/examples/jsm/',
    },
  },
  build: {
    target: 'esnext',
  },
});
