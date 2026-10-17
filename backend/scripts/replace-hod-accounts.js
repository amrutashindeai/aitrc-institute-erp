'use strict';

const dns = require('node:dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const config = require('../src/config/env');

const {
  connectDatabase,
  disconnectDatabase
} = require('../src/config/database');

const User = require('../src/models/User');

const DEPARTMENTS = [
  { name: 'Artificial Intelligence and Machine Learning (Degree)', key: 'aiml.degree' },
  { name: 'Electronics and Telecommunication Engineering (Degree)', key: 'entc.degree' },
  { name: 'Electrical Engineering (Degree)', key: 'electrical.degree' },
  { name: 'Civil Engineering (Degree)', key: 'civil.degree' },
  { name: 'Mechanical Engineering (Degree)', key: 'mechanical.degree' },
  { name: 'Computer Science and Engineering (Degree)', key: 'cse.degree' },
  { name: 'Artificial Intelligence and Machine Learning (Diploma)', key: 'aiml.diploma' },
  { name: 'Electronics and Telecommunication Engineering (Diploma)', key: 'entc.diploma' },
  { name: 'Electrical Engineering (Diploma)', key: 'electrical.diploma' },
  { name: 'Civil Engineering (Diploma)', key: 'civil.diploma' },
  { name: 'Mechanical Engineering (Diploma)', key: 'mechanical.diploma' },
  { name: 'Computer Science and Engineering (Diploma)', key: 'cse.diploma' }
];

function emailFor(department) {
  return `hod.${department.key}@college.edu`;
}

// Password टाइप करताना terminal वर दिसणार नाही.
function askHidden(question) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    const output = process.stdout;

    if (!input.isTTY || typeof input.setRawMode !== 'function') {
      reject(
        new Error(
          'Please run this script in the VS Code integrated terminal.'
        )
      );
      return;
    }

    let value = '';
    let finished = false;

    function cleanup() {
      if (finished) return;
      finished = true;

      input.removeListener('data', onData);
      input.setRawMode(false);
      input.pause();
      output.write('\n');
    }

    function onData(data) {
      for (const ch of data.toString('utf8')) {
        if (ch === '\u0003') {
          cleanup();
          reject(new Error('Password entry cancelled.'));
          return;
        }

        if (ch === '\r' || ch === '\n') {
          cleanup();
          resolve(value);
          return;
        }

        if (ch === '\u007f' || ch === '\b') {
          value = value.slice(0, -1);
        } else if (ch >= ' ' && ch <= '~') {
          value += ch;
        }
      }
    }

    output.write(question);
    input.setRawMode(true);
    input.resume();
    input.on('data', onData);
  });
}

// नेमके 6 alphanumeric characters; किमान 1 letter आणि 1 number.
function validatePassword(password) {
  return /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6}$/.test(password);
}

async function getNewPassword(email, usedPasswords) {
  while (true) {
    const password = await askHidden(
      `Enter new 6-character password for ${email}: `
    );

    const confirmation = await askHidden(
      `Confirm password for ${email}: `
    );

    if (password !== confirmation) {
      console.log('Passwords do not match. Try again.');
      continue;
    }

    if (!validatePassword(password)) {
      console.log(
        'Password must be exactly 6 letters/numbers, with at least one letter and one number.'
      );
      continue;
    }

    if (usedPasswords.has(password)) {
      console.log('Use a different password for each HOD account.');
      continue;
    }

    return password;
  }
}

async function main() {
  if (config.NODE_ENV === 'production') {
    throw new Error(
      'This password-reset script is disabled in production.'
    );
  }

  await connectDatabase();

  let session;

  try {
    const accounts = [];

    // सर्व 12 HOD accounts आधी तपासा.
    for (const department of DEPARTMENTS) {
      const email = emailFor(department);

      const user = await User.findOne({ email })
        .select('email role');

      if (!user || user.role !== 'HOD') {
        throw new Error(
          `HOD account missing or role mismatch: ${email}. No passwords were changed.`
        );
      }

      accounts.push({
        email,
        department: department.name
      });
    }

    console.log('\nAITRC ERP - Set HOD passwords');
    console.log('All 12 existing HOD accounts were found.');
    console.log(
      'Password: exactly 6 alphanumeric characters, with at least one letter and one digit.'
    );
    console.log('Each account must have a different password.');
    console.log('Passwords will remain hidden while typing.');

    const usedPasswords = new Set();
    const passwordUpdates = [];

    // आधी सर्व नवीन passwords घ्या आणि hashes तयार करा.
    for (const account of accounts) {
      console.log(`\nDepartment: ${account.department}`);

      const password = await getNewPassword(
        account.email,
        usedPasswords
      );

      usedPasswords.add(password);

      const passwordHash = await bcrypt.hash(
        password,
        config.BCRYPT_SALT_ROUNDS
      );

      passwordUpdates.push({
        email: account.email,
        passwordHash
      });
    }

    const confirmation = await askHidden(
      '\nType SET_ALL_12_PASSWORDS to save all changes: '
    );

    if (confirmation !== 'SET_ALL_12_PASSWORDS') {
      console.log('Cancelled. No password changes were saved.');
      return;
    }

    session = await mongoose.startSession();

    await session.withTransaction(async () => {
      for (const update of passwordUpdates) {
        const user = await User.findOne({
          email: update.email
        }).session(session);

        if (!user || user.role !== 'HOD') {
          throw new Error(
            `Account changed or missing: ${update.email}`
          );
        }

        user.passwordHash = update.passwordHash;
        user.passwordChangedAt = new Date();

        await user.save({ session });
      }
    });

    console.log(
      '\nSuccess! Passwords updated for all 12 HOD accounts.'
    );

    console.log(
      'Emails, account names, department assignments, roles, and statuses were not changed.'
    );

    console.log(
      'The old hod@college.edu account remains deactivated.'
    );

    console.log(
      'Passwords were not printed. Keep your chosen passwords securely.'
    );

    console.log(
      'Security note: 6-character passwords are weak; use only for testing/demo accounts.'
    );
  } finally {
    if (session) {
      await session.endSession();
    }

    await disconnectDatabase();
  }
}

main().catch(error => {
  console.error('\nPassword update failed:', error.message);
  process.exitCode = 1;
});