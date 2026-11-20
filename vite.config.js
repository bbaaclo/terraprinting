import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' },
  // Pre-bundle the AI runtime at startup, so the page does not reload
  // the first time an image is traced.
  optimizeDeps: { include: ['onnxruntime-web/webgpu', 'tesseract.js'] },
});
