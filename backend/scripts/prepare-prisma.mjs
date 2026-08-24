/**
 * Swap the Prisma datasource to PostgreSQL for hosted deploys.
 *
 * Local development stays on SQLite. Render sets PRISMA_PROVIDER=postgresql
 * during build so `prisma generate` and `prisma db push` target Supabase.
 *
 * JSON payloads remain String columns in the schema, so the same models work
 * on both engines without a data migration.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const provider = (process.env.PRISMA_PROVIDER ?? 'sqlite').toLowerCase();
const schemaPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'prisma', 'schema.prisma');

if (provider !== 'postgresql') {
  console.log(`Prisma provider unchanged (${provider}).`);
  process.exit(0);
}

let schema = readFileSync(schemaPath, 'utf8');

if (!schema.includes('provider = "sqlite"')) {
  console.log('Prisma schema is already using a non-SQLite provider.');
  process.exit(0);
}

schema = schema.replace('provider = "sqlite"', 'provider = "postgresql"');

if (!schema.includes('directUrl')) {
  schema = schema.replace(
    'url      = env("DATABASE_URL")',
    'url       = env("DATABASE_URL")\n  directUrl = env("DIRECT_URL")',
  );
}

writeFileSync(schemaPath, schema);
console.log('Prisma datasource switched to postgresql (with DIRECT_URL).');
