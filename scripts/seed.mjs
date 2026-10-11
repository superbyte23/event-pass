import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';

// Load .env.local / .env into process.env (Next.js does this for the app, but
// this standalone script has to do it itself).
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const name of ['.env.local', '.env']) {
  const path = resolve(root, name);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, raw] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = raw.replace(/^["']|["']$/g, '');
  }
}

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not set. Copy .env.example to .env.local and fill it in.');
  process.exit(1);
}

const { connectDb } = await import('../src/db/index.js');
const { User, Event } = await import('../src/db/models.js');

await connectDb();

const adminEmails = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean);

if (adminEmails.length === 0) {
  console.warn('ADMIN_EMAILS is empty — no admin users will be seeded.');
}

for (const email of adminEmails) {
  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      await existing.save();
      console.log(`promoted ${email} to admin`);
    } else {
      console.log(`admin already present: ${email}`);
    }
    continue;
  }
  const created = await User.create({ email, full_name: email.split('@')[0], role: 'admin' });
  console.log(`created admin ${email} (${created._id})`);
}

const existingEvent = await Event.findOne();
if (!existingEvent) {
  const created = await Event.create({
    name: 'Sample Event',
    slug: 'sample-event',
    description: 'A published sample event created by the seed script.',
    date: new Date().toISOString().slice(0, 10),
    venue: 'Somewhere Nice',
    max_attendees: 100,
    published: true,
    form_fields: [],
  });
  console.log(`created sample event ${created.slug} (${created._id})`);
} else {
  console.log('events collection already has rows — sample event skipped');
}

console.log('seed complete');
await mongoose.disconnect();
