/**
 * Wallet Management for ClawKalash
 * Secure key generation, encryption, and storage
 */

import { privateKeyToAccount, generateMnemonic, mnemonicToAccount, english } from 'viem/accounts';
import * as fs from 'fs';
import * as crypto from 'crypto';

const WALLET_PATH = process.env.WALLET_PATH || './.wallet.enc';
const ENCRYPTION_KEY = process.env.WALLET_KEY || 'clawkalash-default-key-change-me';

interface WalletData {
  address: string;
  encryptedKey: string;
  iv: string;
  createdAt: string;
}

// ============ Encryption ============

function encrypt(text: string, password: string): { encrypted: string; iv: string } {
  const key = crypto.scryptSync(password, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return { encrypted, iv: iv.toString('hex') };
}

function decrypt(encrypted: string, iv: string, password: string): string {
  const key = crypto.scryptSync(password, 'salt', 32);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ============ Wallet Operations ============

export function createWallet(): { mnemonic: string; address: string } {
  const mnemonic = generateMnemonic(english);
  const account = mnemonicToAccount(mnemonic);
  
  const { encrypted, iv } = encrypt(mnemonic, ENCRYPTION_KEY);
  const walletData: WalletData = {
    address: account.address,
    encryptedKey: encrypted,
    iv,
    createdAt: new Date().toISOString(),
  };
  
  fs.writeFileSync(WALLET_PATH, JSON.stringify(walletData, null, 2));
  
  return { mnemonic, address: account.address };
}

export function importWallet(privateKeyOrMnemonic: string): string {
  let address: string;
  let toEncrypt: string;
  
  if (privateKeyOrMnemonic.includes(' ')) {
    const account = mnemonicToAccount(privateKeyOrMnemonic);
    address = account.address;
    toEncrypt = privateKeyOrMnemonic;
  } else {
    const normalized = privateKeyOrMnemonic.startsWith('0x') 
      ? privateKeyOrMnemonic 
      : `0x${privateKeyOrMnemonic}`;
    const account = privateKeyToAccount(normalized as `0x${string}`);
    address = account.address;
    toEncrypt = normalized;
  }
  
  const { encrypted, iv } = encrypt(toEncrypt, ENCRYPTION_KEY);
  const walletData: WalletData = {
    address,
    encryptedKey: encrypted,
    iv,
    createdAt: new Date().toISOString(),
  };
  
  fs.writeFileSync(WALLET_PATH, JSON.stringify(walletData, null, 2));
  return address;
}

export function loadWallet(): { address: string; privateKey: string } | null {
  if (!fs.existsSync(WALLET_PATH)) {
    return null;
  }
  
  const data: WalletData = JSON.parse(fs.readFileSync(WALLET_PATH, 'utf8'));
  const decrypted = decrypt(data.encryptedKey, data.iv, ENCRYPTION_KEY);
  
  if (decrypted.includes(' ')) {
    const account = mnemonicToAccount(decrypted);
    return { address: account.address, privateKey: decrypted };
  } else {
    return { address: data.address, privateKey: decrypted };
  }
}

export function getWalletAddress(): string | null {
  if (!fs.existsSync(WALLET_PATH)) {
    return null;
  }
  const data: WalletData = JSON.parse(fs.readFileSync(WALLET_PATH, 'utf8'));
  return data.address;
}

export function walletExists(): boolean {
  return fs.existsSync(WALLET_PATH);
}

// ============ CLI ============

// Only run CLI when called directly (not when imported)
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     process.argv[1]?.endsWith('wallet.ts');

async function main() {
  if (!isMainModule) return;
  const args = process.argv.slice(2);
  const [action] = args;

  if (action === 'create') {
    if (walletExists()) {
      console.error('❌ Wallet already exists. Delete .wallet.enc to create a new one.');
      process.exit(1);
    }
    
    const { mnemonic, address } = createWallet();
    console.log(`
🔐 ClawKalash Treasury Created

⚠️  CRITICAL: Save this seed phrase NOW.
    It will NEVER be shown again.

┌────────────────────────────────────────────────────────────┐
  ${mnemonic}
└────────────────────────────────────────────────────────────┘

📍 Address: ${address}

After saving securely, delete this terminal output.
`);
    return;
  }

  if (action === 'import') {
    const keyOrMnemonic = args.slice(1).join(' ');
    if (!keyOrMnemonic) {
      console.error('Usage: npx tsx wallet.ts import <private-key-or-mnemonic>');
      process.exit(1);
    }
    
    const address = importWallet(keyOrMnemonic);
    console.log(`✅ Wallet imported: ${address}`);
    console.log('⚠️  Delete the command containing your key from terminal history!');
    return;
  }

  if (action === 'address') {
    const address = getWalletAddress();
    if (!address) {
      console.error('No wallet found. Run: npx tsx wallet.ts create');
      process.exit(1);
    }
    console.log(address);
    return;
  }

  if (action === 'exists') {
    console.log(walletExists() ? 'true' : 'false');
    return;
  }

  console.log(`
ClawKalash Wallet Manager

Usage:
  npx tsx wallet.ts create              Create new wallet (shows seed ONCE)
  npx tsx wallet.ts import <key|phrase> Import existing wallet
  npx tsx wallet.ts address             Show wallet address
  npx tsx wallet.ts exists              Check if wallet exists

Environment:
  WALLET_PATH  Path to encrypted wallet file (default: .wallet.enc)
  WALLET_KEY   Encryption password (default: built-in, change for production!)
`);
}

if (isMainModule) {
  main().catch(console.error);
}
