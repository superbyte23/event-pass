import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  // Native image renderer used for downloadable/embedded ticket images.
  serverExternalPackages: ["sharp"],
  // Vercel expects the default `.next` output directory. Only local builds
  // started with `npm run build:local` use `.next-build`, so they can run next
  // to `next dev` without corrupting its route manifest.
  distDir: process.env.LOCAL_BUILD_DIR === "1" ? ".next-build" : ".next",
};

export default nextConfig;
