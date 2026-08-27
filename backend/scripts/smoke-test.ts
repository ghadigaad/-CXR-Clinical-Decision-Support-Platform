/**
 * End-to-end smoke test against a running API.
 *
 * Sign in through the UI first (email code), copy the `cxr_session` cookie, then:
 *
 *   npm run smoke -- --cookie "cxr_session=..."
 *
 * Creates a throwaway patient, submits a generated test image for analysis, then
 * reviews and finalizes the report. Run it against a development database only: it
 * writes real records and deletes the patient it created on the way out.
 */
import { randomUUID } from 'node:crypto';

import 'dotenv/config';

const BASE_URL = process.env.SMOKE_BASE_URL ?? 'http://localhost:4000';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const cookieArg = arg('cookie') ?? process.env.SMOKE_COOKIE;

if (!cookieArg) {
  console.error('Usage: npm run smoke -- --cookie "cxr_session=..."');
  process.exit(1);
}

let cookie = cookieArg;

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), ...(cookie ? { cookie } : {}) },
  });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0] ?? cookie;
  return response;
}

async function expectOk(response: Response, label: string): Promise<any> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${label} failed (HTTP ${response.status}): ${JSON.stringify(body)}`);
  }
  console.log(`  ok  ${label}`);
  return body;
}

/** Minimal valid 64x64 grayscale PNG, generated so the test needs no fixture file. */
async function testImage(): Promise<Buffer> {
  const { default: sharp } = await import('sharp');
  return sharp({
    create: { width: 320, height: 320, channels: 3, background: { r: 40, g: 40, b: 40 } },
  })
    .png()
    .toBuffer();
}

async function main(): Promise<void> {
  console.log(`Smoke test against ${BASE_URL}\n`);

  await expectOk(await call('/api/auth/me'), 'auth.me');

  const modelInfo = await expectOk(await call('/api/system/model-info'), 'system.model-info');
  console.log(
    `      AI available=${modelInfo.ai.available} modelLoaded=${modelInfo.ai.modelLoaded} version=${modelInfo.ai.modelVersion}`,
  );

  const suffix = randomUUID().slice(0, 8);
  const { patient } = await expectOk(
    await call('/api/patients', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        medicalRecordNumber: `SMOKE-${suffix}`,
        fullName: 'Smoke Test Patient',
        age: 50,
        gender: 'UNDISCLOSED',
        symptoms: 'Synthetic record created by the smoke test.',
      }),
    }),
    'patients.create',
  );

  const form = new FormData();
  form.append('patientId', patient.id);
  form.append('requestId', randomUUID());
  form.append('image', new Blob([await testImage()], { type: 'image/png' }), 'test.png');

  const analyzeResponse = await call('/api/analyze', { method: 'POST', body: form });

  if (analyzeResponse.status === 503) {
    const body = await analyzeResponse.json();
    console.log(`  --  analyze skipped: AI service unavailable (${body.error?.message})`);
    console.log('      Start ai-service with weights installed, or set AI_PROVIDER=mock.\n');
  } else {
    const { analysis } = await expectOk(analyzeResponse, 'analyze');
    console.log(
      `      ${analysis.prediction.label} @ ${(analysis.prediction.confidence * 100).toFixed(1)}% ` +
        `risk=${analysis.riskLevel} source=${analysis.source} model=${analysis.modelVersion}`,
    );

    await expectOk(
      await call(`/api/analyses/${analysis.id}/review`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ comments: 'Smoke test review.' }),
      }),
      'analyses.review',
    );

    await expectOk(
      await call(`/api/analyses/${analysis.id}/finalize`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ finalAssessment: 'Smoke test final assessment.' }),
      }),
      'analyses.finalize',
    );

    await expectOk(await call(`/api/analyses/${analysis.id}/report`), 'analyses.report');
  }

  await expectOk(await call('/api/analyses/stats'), 'analyses.stats');
  await expectOk(await call('/api/analyses'), 'analyses.list');

  // Clean up: deleting the patient cascades to its analyses, reports, and reviews.
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  await prisma.patient.delete({ where: { id: patient.id } });
  await prisma.$disconnect();
  console.log('  ok  cleanup');

  console.log('\nAll checks passed.');
}

main().catch((error) => {
  console.error(`\nFAILED: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
