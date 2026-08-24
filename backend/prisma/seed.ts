/**
 * Creates the initial clinician account with a randomly generated password.
 *
 * The password is printed once and never stored in plain text anywhere, so there is no
 * default credential baked into the repository for an attacker to try.
 */
import { randomBytes } from 'node:crypto';

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_EMAIL?.toLowerCase().trim() || 'clinician@example.org';
const ADMIN_NAME = process.env.SEED_NAME || 'Dr. Alex Morgan';

function generatePassword(): string {
  // 18 bytes of base64url gives ~24 characters of high-entropy, typeable password.
  return randomBytes(18).toString('base64url');
}

async function main(): Promise<void> {
  const existing = await prisma.doctor.findUnique({ where: { email: ADMIN_EMAIL } });

  if (existing) {
    console.log(`\nAccount ${ADMIN_EMAIL} already exists - no changes made.`);
    console.log('To reset the password, run: npm run db:seed -- --reset\n');

    if (!process.argv.includes('--reset')) return;

    const password = generatePassword();
    await prisma.doctor.update({
      where: { id: existing.id },
      data: { passwordHash: await bcrypt.hash(password, 12) },
    });
    printCredentials(ADMIN_EMAIL, password, 'Password reset');
    return;
  }

  const password = generatePassword();
  await prisma.doctor.create({
    data: {
      email: ADMIN_EMAIL,
      passwordHash: await bcrypt.hash(password, 12),
      fullName: ADMIN_NAME,
      specialty: 'Radiology',
      role: 'ADMIN',
    },
  });

  printCredentials(ADMIN_EMAIL, password, 'Account created');
}

function printCredentials(email: string, password: string, title: string): void {
  const line = '='.repeat(58);
  console.log(`\n${line}`);
  console.log(`  ${title}`);
  console.log(line);
  console.log(`  Email    : ${email}`);
  console.log(`  Password : ${password}`);
  console.log(line);
  console.log('  Save this password now. It is not recoverable and will');
  console.log('  not be shown again.');
  console.log(`${line}\n`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
