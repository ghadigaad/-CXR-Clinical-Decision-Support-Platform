/**
 * Print database hosts from env so a bad URL (e.g. localhost) is obvious in Render logs.
 * Never prints the password.
 */
function describe(name) {
  const raw = process.env[name];
  if (!raw) {
    console.log(`${name}: <unset>`);
    return;
  }

  try {
    const normalized = raw.replace(/^postgres(ql)?:/i, 'http:');
    const parsed = new URL(normalized);
    const port = parsed.port || '5432';
    console.log(`${name}: host=${parsed.hostname} port=${port} db=${parsed.pathname}`);
  } catch {
    console.log(`${name}: <could not parse as a URL, length=${raw.length}>`);
  }
}

describe('DATABASE_URL');
describe('DIRECT_URL');
