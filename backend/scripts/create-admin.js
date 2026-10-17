const readline = require('node:readline/promises');
const bcrypt = require('bcryptjs');
const config = require('../src/config/env');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const User = require('../src/models/User');

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const name = (await rl.question('Administrator full name: ')).trim();
    const email = (await rl.question('Administrator email: ')).trim().toLowerCase();
    const password = await rl.question('Initial password (12+ characters): ');
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      throw new Error('Name/email/password did not meet validation requirements.');
    }
    await connectDatabase();
    if (await User.exists({ email })) throw new Error('A user with that email already exists.');
    const passwordHash = await bcrypt.hash(password, config.BCRYPT_SALT_ROUNDS);
    const user = await User.create({ name, email, passwordHash, role: 'ADMIN', isActive: true });
    console.log(`Created administrator ${user.email} (id: ${user.id}). Store credentials securely.`);
  } finally {
    rl.close();
    await disconnectDatabase();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
