import { readdir, readFile, writeFile } from 'node:fs/promises';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';
export async function compressBuild(directory: string) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = directory + '/' + entry.name;
    if (entry.isDirectory()) {
      await compressBuild(path);
      continue;
    }
    if (!/\.(js|css|glb|json|svg|html)$/.test(path)) continue;
    const bytes = await readFile(path);
    if (bytes.length < 1024) continue;
    await Promise.all([
      writeFile(path + '.gz', gzipSync(bytes, { level: 9 })),
      writeFile(
        path + '.br',
        brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } }),
      ),
    ]);
  }
}
