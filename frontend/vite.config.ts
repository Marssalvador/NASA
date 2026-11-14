import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compressBuild } from './scripts/compress-build.ts';
const anatomySource = fileURLToPath(new URL('../assets/models/runtime/', import.meta.url));
const anatomyFolder = fileURLToPath(new URL('./public/models/', import.meta.url));
if (existsSync(anatomySource)) {
  mkdirSync(anatomyFolder, { recursive: true });
  for (const name of readdirSync(anatomySource))
    copyFileSync(anatomySource + name, anatomyFolder + name);
  if (existsSync(anatomyFolder + 'humanoid.glb')) unlinkSync(anatomyFolder + 'humanoid.glb');
}
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'local-precompression',
      apply: 'build',
      async closeBundle() {
        await compressBuild(fileURLToPath(new URL('./dist/', import.meta.url)));
      },
    },
  ],
  server: { proxy: { '/api': 'http://127.0.0.1:8000' } },
  preview: { host: '127.0.0.1' },
});
