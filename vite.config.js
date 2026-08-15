import { defineConfig } from 'vite';

export default defineConfig({
  // O frontend não consome variáveis de ambiente; não carregue o .env do
  // backend (que contém NODE_ENV e segredos de operação) durante o bundle.
  envDir: '.vite-env',
  server: {
    port: 3000,
    proxy: { '/api': 'http://localhost:3001' },
  },
});
