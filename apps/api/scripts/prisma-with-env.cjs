#!/usr/bin/env node
const path = require('path');
const { spawnSync } = require('child_process');
const dotenv = require('dotenv');

const rootEnvPath = path.resolve(__dirname, '../../../.env');
const localEnvPath = path.resolve(__dirname, '../.env');

dotenv.config({ path: rootEnvPath });
dotenv.config({ path: localEnvPath, override: true });

const prismaCliPath = require.resolve('prisma/build/index.js');
const args = process.argv.slice(2);

const result = spawnSync(process.execPath, [prismaCliPath, ...args], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
