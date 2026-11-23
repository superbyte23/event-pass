import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  // Native image renderer used for downloadable/embedded ticket images.
  serverExternalPackages: ["sharp"],
  // Keep `next dev` and `next build` from writing the same .next directory.
  // Running a build while the dev server is up corrupts its route manifest
  // (the intermittent "no direct app page entry found for /_not-found" crash).
  distDir: process.env.NODE_ENV === "production" ? ".next-build" : ".next",
};

export default nextConfig;
