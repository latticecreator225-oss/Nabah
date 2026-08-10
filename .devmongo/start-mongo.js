// Dev-only embedded MongoDB on a fixed port (27017) with persistent data,
// so the Nabah backend can run the full app (onboarding, bookmarks, prefs,
// the reminder scheduler) without installing MongoDB or Docker.
const { MongoMemoryServer } = require('mongodb-memory-server');
const path = require('path');
const fs = require('fs');

(async () => {
  const dbPath = path.join(__dirname, 'data');
  fs.mkdirSync(dbPath, { recursive: true });
  const server = await MongoMemoryServer.create({
    instance: { port: 27017, dbPath, storageEngine: 'wiredTiger' },
  });
  console.log('MONGO_READY ' + server.getUri());
  const stop = async () => { try { await server.stop(); } catch {} process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  setInterval(() => {}, 1 << 30); // keep alive
})().catch((e) => { console.error('MONGO_FAIL', e); process.exit(1); });
