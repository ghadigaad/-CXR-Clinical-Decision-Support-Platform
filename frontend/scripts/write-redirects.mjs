/**
 * Write Netlify proxy rules so the browser talks to one origin.
 *
 * Same-origin /api keeps the httpOnly session cookie on SameSite=strict.
 * Set API_PROXY_URL in the Netlify dashboard to the Render origin, e.g.
 * https://cxr-api.onrender.com (no trailing slash).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const origin = (process.env.API_PROXY_URL ?? '').trim().replace(/\/$/, '');

if (!origin) {
  console.error(
    'API_PROXY_URL is required for a Netlify build.\n' +
      'In Site configuration → Environment variables, set it to your Render origin\n' +
      '(https://YOUR-SERVICE.onrender.com) with no trailing slash.',
  );
  process.exit(1);
}

if (!/^https:\/\//i.test(origin)) {
  console.error(`API_PROXY_URL must be an https origin. Got: ${origin}`);
  process.exit(1);
}

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
mkdirSync(publicDir, { recursive: true });

writeFileSync(
  join(publicDir, '_redirects'),
  [
    `# Generated at build time. Do not edit by hand.`,
    `/api/*  ${origin}/api/:splat  200!`,
    `/*      /index.html           200`,
    '',
  ].join('\n'),
);

console.log(`Wrote same-origin /api proxy to ${origin}`);
