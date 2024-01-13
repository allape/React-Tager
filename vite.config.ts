import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const basePath = process.env.APP_BASE_PATH || undefined;
const outDir = process.env.APP_OUTDIR || 'dist';

// https://vitejs.dev/config/
export default defineConfig({
  base:  basePath,
  build: {
    outDir,
  },
  plugins: [react()],
});
