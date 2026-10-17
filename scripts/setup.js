#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const envFiles = [
  { example: path.join(root, 'backend', '.env.example'), target: path.join(root, 'backend', '.env') },
  { example: path.join(root, 'frontend', '.env.example'), target: path.join(root, 'frontend', '.env') }
];

for (const { example, target } of envFiles) {
  if (!fs.existsSync(example)) {
    console.error(`Missing environment template: ${path.relative(root, example)}`);
    process.exitCode = 1;
    continue;
  }
  if (fs.existsSync(target)) {
    console.log(`Kept existing ${path.relative(root, target)}`);
    continue;
  }

  let contents = fs.readFileSync(example, 'utf8');
  if (target.endsWith(path.join('backend', '.env'))) {
    const secret = crypto.randomBytes(48).toString('base64url');
    contents = contents.replace(
      /^JWT_ACCESS_SECRET=.*$/m,
      `JWT_ACCESS_SECRET=${secret}`
    );
  }
  fs.writeFileSync(target, contents, { flag: 'wx', mode: 0o600 });
  console.log(`Created ${path.relative(root, target)}`);
}

if (process.exitCode) {
  console.error('Setup was incomplete. Resolve the missing template(s) and run npm run setup again.');
} else {
  console.log('Environment setup complete. Review backend/.env and frontend/.env before starting the app.');
}
