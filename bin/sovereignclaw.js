#!/usr/bin/env node

/**
 * SovereignClaw CLI
 * Economic sovereignty for AI agents
 * 
 * Usage:
 *   sovereignclaw setup          - Configure wallet and RPC
 *   sovereignclaw portfolio      - Check balances across chains
 *   sovereignclaw quote          - Get bridge/swap quotes
 *   sovereignclaw bridge         - Execute CCTP bridge
 *   sovereignclaw swap           - Execute swap via Bungee
 *   sovereignclaw status <txId>  - Check transaction status
 */

import { spawn } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = join(homedir(), '.sovereignclaw');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

const COMMANDS = {
  setup: handleSetup,
  portfolio: () => runScript('bungee.ts', 'portfolio'),
  quote: () => runScript('bungee.ts', 'quote'),
  swap: () => runScript('bungee.ts', 'swap'),
  bridge: () => runScript('bridge.ts'),
  status: () => runScript('bungee.ts', 'status'),
  help: showHelp,
};

function showHelp() {
  console.log(`
🦀 SovereignClaw - Economic sovereignty for AI agents

Commands:
  setup              Configure wallet and environment
  portfolio          Check USDC balances across chains
  quote <params>     Get bridge/swap quote
  bridge <params>    Execute CCTP cross-chain transfer
  swap <params>      Execute swap via Bungee
  status <txId>      Check transaction status
  help               Show this message

Environment:
  WALLET_KEY         Encryption key for wallet storage
  RPC_SEPOLIA        Sepolia RPC URL
  RPC_BASE_SEPOLIA   Base Sepolia RPC URL

Example:
  sovereignclaw setup
  sovereignclaw portfolio
  sovereignclaw bridge --from sepolia --to base-sepolia --amount 10

Docs: https://github.com/dimsome/sovereignclaw
`);
}

async function handleSetup() {
  console.log('🦀 SovereignClaw Setup\n');

  // Create config directory
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
    console.log(`✓ Created ${CONFIG_DIR}`);
  }

  // Check for existing config
  if (existsSync(CONFIG_FILE)) {
    const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
    console.log(`\n📋 Existing config found:`);
    console.log(`   Wallet: ${config.walletAddress || 'not set'}`);
    console.log(`   Sepolia RPC: ${config.rpcSepolia ? '✓' : '✗'}`);
    console.log(`   Base Sepolia RPC: ${config.rpcBaseSepolia ? '✓' : '✗'}`);
    console.log(`\nTo reconfigure, delete ${CONFIG_FILE} and run setup again.`);
    return;
  }

  console.log(`
To complete setup, create ${CONFIG_FILE} with:

{
  "walletAddress": "0x...",
  "rpcSepolia": "https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY",
  "rpcBaseSepolia": "https://base-sepolia.g.alchemy.com/v2/YOUR_KEY"
}

Or set environment variables:
  export WALLET_KEY="your-encryption-passphrase"
  export RPC_SEPOLIA="https://..."
  export RPC_BASE_SEPOLIA="https://..."

Then run: sovereignclaw portfolio
`);

  // Create template config
  const template = {
    walletAddress: '',
    rpcSepolia: '',
    rpcBaseSepolia: '',
    note: 'Fill in your values. Get free RPC from Alchemy or Infura.',
  };
  writeFileSync(CONFIG_FILE, JSON.stringify(template, null, 2));
  console.log(`✓ Created template config at ${CONFIG_FILE}`);
}

function runScript(script, ...args) {
  const scriptPath = join(__dirname, '..', 'scripts', script);
  const child = spawn('npx', ['tsx', scriptPath, ...args, ...process.argv.slice(3)], {
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
    return {
      RPC_SEPOLIA: config.rpcSepolia,
      RPC_BASE_SEPOLIA: config.rpcBaseSepolia,
    };
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
