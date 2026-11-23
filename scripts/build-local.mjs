// Local-only production build that writes to `.next-build` so it can run next
// to `next dev`. Vercel keeps using the normal `next build` → `.next`.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const nextBin = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url));
const result = spawnSync(process.execPath, [nextBin, 'build'], {
  stdio: 'inherit',
  env: { ...process.env, LOCAL_BUILD_DIR: '1' },
});

process.exit(result.status ?? 1);
