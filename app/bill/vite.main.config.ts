import { defineConfig } from 'vite';
import swc from '@rollup/plugin-swc';

// https://vitejs.dev/config
export default defineConfig({
  plugins: [
    swc(),
  ],
  esbuild: false,
});
