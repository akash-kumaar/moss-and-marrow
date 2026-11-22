import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    server: {
      proxy: {
        '/api/v1': {
          target: env.VITE_DEV_API_TARGET || 'http://127.0.0.1:5000',
          changeOrigin: true,
        },
      },
    },
  };
});
