import { defineConfig } from 'vite';
import { cpSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const r = (p) => resolve(dirname(fileURLToPath(import.meta.url)), p);

/**
 * 构建后把「运行时按需 fetch 的 Markdown 目录」复制进 dist。
 * 这些 .md 不是被 import 的模块，Vite 不会自动打包；开发期由 Vite 静态托管根目录直接可读，
 * 故仅需在 build 末尾把它们搬到 dist 对应位置。
 */
function copyContent(...dirs) {
  return {
    name: 'copy-content',
    apply: 'build',
    closeBundle() {
      const out = r('dist');
      for (const d of dirs) {
        const src = r(d);
        if (existsSync(src)) cpSync(src, resolve(out, d), { recursive: true });
      }
    },
  };
}

export default defineConfig({
  base: './',                 // 相对路径：配合 hash 路由，产物可部署到任意子路径 / 静态托管
  publicDir: false,           // courses/ 与 progress/ 用 copy-content 插件手动搬运，不放进 public
  plugins: [copyContent('courses', 'progress')],
  server: { port: 5180, host: true, strictPort: false },   // 开发：npm run dev → http://localhost:5180
  preview: { port: 8080, host: true, strictPort: false },  // 生产预览：npm run prod → http://localhost:8080
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2020' },
});
