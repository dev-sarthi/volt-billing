/**
 * Seed script that uses in-memory MongoDB.
 * Useful when you don't have a local mongod installed.
 *
 * Usage:
 *   node scripts/seed-memory.js
 */

const { MongoMemoryServer } = require('mongodb-memory-server');

async function run() {
  console.log('⏳ Starting in-memory MongoDB for seeding…');
  const mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();

  // Dynamically load the seed logic
  // We need to require after setting the env
  const seed = require('./seed');
  await seed();
  
  // Close the DB
  const mongoose = require('mongoose');
  await mongoose.disconnect();
  await mongod.stop();
  console.log('Database seeded and closed successfully.');
}

run().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
