'use strict';

const bcrypt = require('bcryptjs');
const config = require('../src/config/env');
const {
  connectDatabase,
  disconnectDatabase
} = require('../src/config/database');
const User = require('../src/models/User');
const readline = require('node:readline');

const EMAIL = 'hod@college.edu';

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  if (config.NODE_ENV === 'production') {
    throw new Error(
      'Password reset is disabled in production.'
    );
  }

  const password = await ask('Enter a new HOD password: ');
  const confirm = await ask('Confirm the new password: ');

  if (password !== confirm) {
    throw new Error('Passwords do not match.');
  }

  if (
    password.length < 12 ||
    !/[A-Za-z]/.test(password) ||
    !/[0-9]/.test(password)
  ) {
    throw new Error(
      'Use at least 12 characters, including a letter and a number.'
    );
  }

  await connectDatabase();

  try {
    const user = await User.findOne({ email: EMAIL })
      .select('+passwordHash');

    if (!user) {
      throw new Error(`User not found: ${EMAIL}`);
    }

    if (user.role !== 'HOD') {
      throw new Error('This account does not have the HOD role.');
    }

    user.passwordHash = await bcrypt.hash(
      password,
      config.BCRYPT_SALT_ROUNDS
    );

    user.passwordChangedAt = new Date();

    await user.save();

    console.log(`Password reset completed for ${EMAIL}.`);
    console.log(`Account active: ${user.isActive}`);
    console.log('Role and account status were not changed.');
  } finally {
    await disconnectDatabase();
  }
}

main().catch(error => {
  console.error('Reset failed:', error.message);
  process.exitCode = 1;
});