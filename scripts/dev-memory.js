/**
 * Dev helper — starts the app with an in-memory MongoDB instance.
 * Useful when you don't have a local mongod installed.
 *
 * Usage:
 *   node scripts/dev-memory.js
 */

const { MongoMemoryServer } = require('mongodb-memory-server');

async function start() {
  console.log('⏳ Starting in-memory MongoDB…');
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  console.log(`✓ In-memory MongoDB running at ${uri}`);

  // Override env so server.js picks it up
  process.env.MONGO_URI = uri;
  process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'dev_memory_secret';
  process.env.PORT = process.env.PORT || '3000';

  // Seed the in-memory DB before starting the app
  console.log('⏳ Seeding database...');
  // We mock process.exit so seed.js doesn't kill the dev server
  const originalExit = process.exit;
  process.exit = () => {}; 
  // Run the seed script
  await require('./seed')();
  // Restore exit
  process.exit = originalExit;

  // Now load the main server
  require('../server');
}

start().catch((err) => {
  console.error('Failed to start dev server:', err);
  process.exit(1);
});
