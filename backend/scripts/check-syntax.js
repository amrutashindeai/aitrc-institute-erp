const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const roots = ['src', 'scripts', 'tests'].map(name => path.resolve(__dirname, '..', name));
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.js')) files.push(full);
  }
}
for (const root of roots) if (fs.existsSync(root)) walk(root);
let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failed = true;
    process.stderr.write(`${file}\n${result.stderr}`);
  }
}
if (failed) process.exit(1);
console.log(`Syntax OK: ${files.length} JavaScript files checked.`);
