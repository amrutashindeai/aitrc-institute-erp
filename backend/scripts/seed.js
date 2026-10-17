const readline = require('node:readline/promises');
const bcrypt = require('bcryptjs');
const config = require('../src/config/env');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const User = require('../src/models/User');
const AcademicYear = require('../src/models/AcademicYear');
const Department = require('../src/models/Department');

async function main() {
  if (config.NODE_ENV === 'production') throw new Error('Seed script is disabled in production.');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const email = (await rl.question('Seed admin email: ')).trim().toLowerCase();
    const password = await rl.question('Seed admin password (12+ characters): ');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) throw new Error('Invalid seed administrator credentials.');
    await connectDatabase();
    if (!(await User.exists({ email }))) await User.create({ name: 'ERP Administrator', email, passwordHash: await bcrypt.hash(password, config.BCRYPT_SALT_ROUNDS), role: 'ADMIN', isActive: true });
    await Department.updateOne({ code: 'CSE' }, { $setOnInsert: { name: 'Computer Science and Engineering', code: 'CSE', description: 'Seed sample department', isActive: true } }, { upsert: true });
    const existingYear = await AcademicYear.findOne({ name: '2026-2027' });
    if (!existingYear) {
      const hasActiveYear = await AcademicYear.exists({ isActive: true });
      await AcademicYear.create({ name: '2026-2027', startDate: new Date('2026-06-01T00:00:00.000Z'), endDate: new Date('2027-05-31T23:59:59.999Z'), isActive: !hasActiveYear });
    }
    console.log('Seed completed. Existing records were preserved.');
  } finally { rl.close(); await disconnectDatabase(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
