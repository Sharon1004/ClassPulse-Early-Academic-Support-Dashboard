import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, API calls to /api are forwarded to the Express server on port 5000.
// In production the Express server serves the built files from client/dist, so no proxy is needed.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': process.env.VITE_API_PROXY || 'http://localhost:5000' } },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
});
