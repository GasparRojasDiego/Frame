import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import path from 'node:path';

// ============================================================
// Métricas de Frame (1.7.0): el Panel de uso, fuera de la app, como página
// web aparte. Se compila a `website/metricas/` y se publica con la web.
//
//   npm run metricas        → compila
//   npm run metricas:dev    → prueba local
//
// Comparte con la app sus piezas (botones, tarjetas, informes) por el alias
// `@/`; `@/lib/i18n` se cambia por uno solo en español y `@m/` es lo propio.
// ============================================================

const envDir = path.resolve(__dirname, '..');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, 'VITE_SUPABASE_');
  const supabaseOrigin = env.VITE_SUPABASE_URL ? new URL(env.VITE_SUPABASE_URL).origin : '';
  // Política de contenido: solo código propio y solo se habla con Supabase.
  // Va en la página publicada; en la prueba local Vite necesita lo suyo.
  const csp = [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${supabaseOrigin}`,
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "worker-src 'none'",
    "manifest-src 'none'",
  ].join('; ');

  return {
    root: __dirname,
    base: './',
    envDir,
    // Solo las dos claves públicas de Supabase: nada más de `.env` entra en la página.
    envPrefix: 'VITE_SUPABASE_',
    plugins: [
      react(),
      {
        name: 'metricas-csp',
        apply: 'build',
        transformIndexHtml: (html: string) =>
          html.replace('<!--csp-->', `<meta http-equiv="Content-Security-Policy" content="${csp}" />`),
      },
    ],
    resolve: {
      alias: [
        { find: /^@\/lib\/i18n$/, replacement: path.resolve(__dirname, 'src/lib/i18n.ts') },
        { find: /^@m\//, replacement: `${path.resolve(__dirname, 'src')}/` },
        { find: /^@\//, replacement: `${path.resolve(__dirname, '../src')}/` },
      ],
    },
    css: {
      postcss: { plugins: [tailwindcss({ config: path.resolve(__dirname, 'tailwind.config.ts') })] },
    },
    server: { port: 9004, strictPort: true },
    build: {
      outDir: path.resolve(__dirname, '../website/metricas'),
      emptyOutDir: true,
      target: 'es2022',
      sourcemap: false,
      chunkSizeWarningLimit: 1500,
    },
  };
});
