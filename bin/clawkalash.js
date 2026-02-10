#!/usr/bin/env node

/**
 * ClawKalash CLI
 * Economic sovereignty for AI agents. Served on a stick.
 * 
 * Usage:
 *   clawkalash setup          - Configure wallet and RPC
 *   clawkalash portfolio      - Check balances across chains
 *   clawkalash quote          - Get swap quotes
 *   clawkalash swap           - Execute swap via Bungee
 *   clawkalash status <hash>  - Check transaction status
 *   clawkalash wallet         - Wallet operations
 */

import { spawn } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = join(homedir(), '.clawkalash');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

const COMMANDS = {
  setup: handleSetup,
  portfolio: () => runScript('bungee.js', 'portfolio'),
  quote: () => runScript('bungee.js', 'quote'),
  swap: () => runScript('bungee.js', 'swap'),
  status: () => runScript('bungee.js', 'status'),
  wallet: () => runScript('wallet.js'),
  'wallet-create': () => runScript('bungee.js', 'wallet-create'),
  'wallet-import': () => runScript('bungee.js', 'wallet-import'),
  'wallet-address': () => runScript('bungee.js', 'wallet-address'),
  help: showHelp,
};

function showHelp() {
  console.log(`
🥩 ClawKalash — Economic sovereignty for AI agents

Commands:
  setup              Configure wallet and environment
  portfolio          Check token balances across chains
  quote <params>     Get swap quote
  swap <params>      Execute swap via Bungee
  status <hash>      Check transaction status
  wallet             Wallet operations (create/import/address)
  help               Show this message

Environment:
  WALLET_KEY         Encryption key for wallet storage
  PRIVATE_KEY        Direct private key (alternative to wallet)

Example:
  clawkalash setup
  clawkalash portfolio
  clawkalash swap 8453 42161 0xEeee...EEEE 0x833589...02913 1000000000000000

Docs: https://github.com/dimsome/ClawKalash
`);
}

async function handleSetup() {
  console.log('🥩 ClawKalash Setup\n');

  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
    console.log(`✓ Created ${CONFIG_DIR}`);
  }

  if (existsSync(CONFIG_FILE)) {
    const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
    console.log(`\n📋 Existing config found:`);
    console.log(`   Wallet: ${config.walletAddress || 'not set'}`);
    console.log(`\nTo reconfigure, delete ${CONFIG_FILE} and run setup again.`);
    return;
  }

  console.log(`
To complete setup, create ${CONFIG_FILE} with:

{
  "walletAddress": "0x..."
}

Or set environment variables:
  export WALLET_KEY="your-encryption-passphrase"

Then run: clawkalash portfolio
`);

  const template = {
    walletAddress: '',
    note: 'Fill in your values.',
  };
  writeFileSync(CONFIG_FILE, JSON.stringify(template, null, 2));
  console.log(`✓ Created template config at ${CONFIG_FILE}`);
}

function runScript(script, ...args) {
  const scriptPath = join(__dirname, '..', 'dist', script);
  
  const child = spawn('node', [scriptPath, ...args, ...process.argv.slice(3)], {
    stdio: 'inherit',
    env: {
      ...process.env,
      ...(existsSync(CONFIG_FILE) ? loadEnvFromConfig() : {}),
    },
  });

  child.on('exit', (code) => process.exit(code));
}

function loadEnvFromConfig() {
  try {
    const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
    return {};
  } catch {
    return {};
  }
}

// Main
const command = process.argv[2] || 'help';
const handler = COMMANDS[command];

if (handler) {
  handler();
} else {
  console.error(`Unknown command: ${command}`);
  showHelp();
  process.exit(1);
}
