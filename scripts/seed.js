/**
 * Seed script — creates initial admin, reader, tariff plans, and realistic demo data.
 *
 * Usage:
 *   node scripts/seed.js
 *
 * It will drop any existing documents and recreate them,
 * so it is safe to run repeatedly during development.
 */

require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const User = require('../models/User');
const TariffPlan = require('../models/TariffPlan');
const Consumer = require('../models/Consumer');
const Meter = require('../models/Meter');
const MeterReading = require('../models/MeterReading');
const Bill = require('../models/Bill');
const billingService = require('../services/billingService');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/billing_system';
const SALT_ROUNDS = 10;

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('✓ Connected to MongoDB');

  // Clear everything
  await User.deleteMany({});
  await TariffPlan.deleteMany({});
  await Consumer.deleteMany({});
  await Meter.deleteMany({});
  await MeterReading.deleteMany({});
  await Bill.deleteMany({});

  /* ── Users ─────────────────────────────────────────────────────── */
  const adminHash = await bcrypt.hash('admin123', SALT_ROUNDS);
  const readerHash = await bcrypt.hash('reader123', SALT_ROUNDS);
  const consumerHash = await bcrypt.hash('consumer123', SALT_ROUNDS);

  const admin = await User.create({
    name: 'System Admin',
    email: 'admin@billing.local',
    passwordHash: adminHash,
    role: 'admin',
  });
  console.log(`  → Admin created : ${admin.email}`);

  const reader = await User.create({
    name: 'Field Reader',
    email: 'reader@billing.local',
    passwordHash: readerHash,
    role: 'reader',
  });
  console.log(`  → Reader created: ${reader.email}`);

  /* ── Tariff Plans ──────────────────────────────────────────────── */
  const domestic = await TariffPlan.create({
    connectionType: 'domestic',
    utilityType: 'electricity',
    slabs: [
      { minUnits: 0, maxUnits: 100, ratePerUnit: 3 },
      { minUnits: 101, maxUnits: 200, ratePerUnit: 5 },
      { minUnits: 201, maxUnits: 999999, ratePerUnit: 7 },
    ],
    fixedCharge: 75,
    active: true,
  });

  const commercial = await TariffPlan.create({
    connectionType: 'commercial',
    utilityType: 'electricity',
    slabs: [
      { minUnits: 0, maxUnits: 100, ratePerUnit: 5 },
      { minUnits: 101, maxUnits: 300, ratePerUnit: 8 },
      { minUnits: 301, maxUnits: 999999, ratePerUnit: 12 },
    ],
    fixedCharge: 150,
    active: true,
  });
  const waterDomestic = await TariffPlan.create({
    connectionType: 'domestic',
    utilityType: 'water',
    slabs: [
      { minUnits: 0, maxUnits: 10, ratePerUnit: 10 },
      { minUnits: 11, maxUnits: 999999, ratePerUnit: 20 },
    ],
    fixedCharge: 50,
    active: true,
  });

  const waterCommercial = await TariffPlan.create({
    connectionType: 'commercial',
    utilityType: 'water',
    slabs: [
      { minUnits: 0, maxUnits: 50, ratePerUnit: 25 },
      { minUnits: 51, maxUnits: 999999, ratePerUnit: 40 },
    ],
    fixedCharge: 100,
    active: true,
  });

  console.log('  → Tariff plans created');

  /* ── Consumers & Demo Data ─────────────────────────────────────── */
  const consumersData = [
    { name: 'John Doe', type: 'domestic', utility: 'electricity' },
    { name: 'Alice Smith', type: 'domestic', utility: 'electricity' },
    { name: 'Bob Johnson', type: 'domestic', utility: 'water' },
    { name: 'Acme Corp', type: 'commercial', utility: 'electricity' },
    { name: 'Tech Solutions', type: 'commercial', utility: 'electricity' },
    { name: 'Global Retail', type: 'commercial', utility: 'water' }
  ];

  const months = ['2026-06', '2026-07', '2026-08'];
  const monthDates = [
    new Date('2026-06-15'),
    new Date('2026-07-15'),
    new Date('2026-08-15')
  ];

  for (let i = 0; i < consumersData.length; i++) {
    const cData = consumersData[i];
    
    // 1. Create User
    const user = await User.create({
      name: cData.name,
      email: `consumer${i + 1}@billing.local`,
      passwordHash: consumerHash,
      role: 'consumer'
    });

    // 2. Create Consumer
    const consumer = await Consumer.create({
      consumerId: `CNS-100${i + 1}`,
      userId: user._id,
      connectionType: cData.type,
      utilityType: cData.utility,
      address: `${100 + i} Main Street`
    });

    // 3. Create Meter
    const meter = await Meter.create({
      meterNumber: `MTR-900${i + 1}`,
      consumerId: consumer._id,
      status: 'active'
    });

    // 4. Generate 4 months of history
    let previousReading = 0;
    
    for (let m = 0; m < months.length; m++) {
      const unitsConsumed = Math.floor(Math.random() * 300) + 50; // 50 to 350
      const currentReading = previousReading + unitsConsumed;
      
      const reading = await MeterReading.create({
        meterId: meter._id,
        billingMonth: months[m],
        previousReading,
        currentReading,
        unitsConsumed,
        enteredBy: reader._id
      });
      
      let plan = domestic;
      if (cData.type === 'commercial' && cData.utility === 'electricity') plan = commercial;
      if (cData.type === 'domestic' && cData.utility === 'water') plan = waterDomestic;
      if (cData.type === 'commercial' && cData.utility === 'water') plan = waterCommercial;
      
      const charges = billingService.computeBill(unitsConsumed, plan);
      
      const dueDate = new Date(monthDates[m]);
      dueDate.setDate(dueDate.getDate() + 15); // due 15 days after bill generated
      
      // Determine realistic status
      // Older bills are usually paid, the latest might be unpaid/overdue
      let status = 'paid';
      if (m === 3) {
        status = 'unpaid'; // September bill is unpaid (will become overdue if we pass due date)
      } else if (m === 2 && i % 2 === 0) {
        status = 'unpaid'; // Half of the August bills were never paid (will become overdue)
      }
      
      await Bill.create({
        consumerId: consumer._id,
        meterReadingId: reading._id,
        billingMonth: months[m],
        usageCharge: charges.usageCharge,
        fixedCharge: charges.fixedCharge,
        totalAmount: charges.totalAmount,
        dueDate,
        status,
        paidDate: status === 'paid' ? new Date(dueDate.getTime() - 2 * 24 * 60 * 60 * 1000) : null
      });

      previousReading = currentReading;
    }
    
    console.log(`  → Demo data created for: ${user.email} (${cData.type})`);
  }

  /* ── Done ──────────────────────────────────────────────────────── */

  console.log('\n✓ Seed complete. You can login with:');
  console.log('  Admin: admin@billing.local / admin123');
  console.log('  Reader: reader@billing.local / reader123');
  console.log('  Consumer: consumer1@billing.local / consumer123');
}

module.exports = seed;

// Run directly if called from CLI
if (require.main === module) {
  seed()
    .then(() => mongoose.disconnect())
    .catch((err) => {
      console.error('✗ Seed failed:', err);
      process.exit(1);
    });
}
