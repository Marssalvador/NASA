/** Encode generated PNG originals as local WebP without changing composition. */
import sharp from 'sharp';
import { mkdir, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const source = fileURLToPath(new URL('../../assets/illustrations/source/', import.meta.url));
const target = fileURLToPath(new URL('../public/media/systems/', import.meta.url));
await mkdir(target, { recursive: true });
for (const name of (await readdir(source)).filter((name) => name.endsWith('.png'))) {
  const result = target + name.replace('.png', '.webp');
  await sharp(source + name).resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 84, effort: 6 }).toFile(result);
  console.log(name, (await stat(result)).size, 'bytes');
}
