/**
 * Wallet Management for ClawKalash
 * Secure key generation, encryption, and storage
 */

import { privateKeyToAccount, generateMnemonic, mnemonicToAccount, english } from 'viem/accounts';
import * as fs from 'fs';
import * as crypto from 'crypto';

function getWalletPath(): string {
  return process.env.WALLET_PATH || './.wallet.enc';
}

function getEncryptionKey(): string {
  const key = process.env.WALLET_KEY;
  if (!key) {
    throw new Error('Set WALLET_KEY environment variable before creating or accessing a wallet');
  }
  return key;
}

interface WalletData {
  address: string;
  encryptedKey: string;
  iv: string;
  salt: string;
  createdAt: string;
}

// ============ Encryption ============

export function encrypt(text: string, password: string): { encrypted: string; iv: string; salt: string } {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return { encrypted, iv: iv.toString('hex'), salt: salt.toString('hex') };
}

export function decrypt(encrypted: string, iv: string, salt: string, password: string): string {
  const key = crypto.scryptSync(password, Buffer.from(salt, 'hex'), 32);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ============ Wallet Operations ============

export function createWallet(): { mnemonic: string; address: string } {
  const encryptionKey = getEncryptionKey();
  const mnemonic = generateMnemonic(english);
  const account = mnemonicToAccount(mnemonic);
  
  const { encrypted, iv, salt } = encrypt(mnemonic, encryptionKey);
  const walletData: WalletData = {
    address: account.address,
    encryptedKey: encrypted,
    iv,
    salt,
    createdAt: new Date().toISOString(),
  };
  
  fs.writeFileSync(getWalletPath(), JSON.stringify(walletData, null, 2), { mode: 0o600 });
  
  return { mnemonic, address: account.address };
}

export function importWallet(privateKeyOrMnemonic: string): string {
  const encryptionKey = getEncryptionKey();
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
  
  const { encrypted, iv, salt } = encrypt(toEncrypt, encryptionKey);
  const walletData: WalletData = {
    address,
    encryptedKey: encrypted,
    iv,
    salt,
    createdAt: new Date().toISOString(),
  };
  
  fs.writeFileSync(getWalletPath(), JSON.stringify(walletData, null, 2), { mode: 0o600 });
  return address;
}

export function loadWallet(): { address: string; privateKey: string } | null {
  if (!fs.existsSync(getWalletPath())) {
    return null;
  }
  
  const encryptionKey = getEncryptionKey();
  const data: WalletData = JSON.parse(fs.readFileSync(getWalletPath(), 'utf8'));
  
  // Support legacy wallets without salt (use 'salt' string as before)
  const salt = data.salt || Buffer.from('salt').toString('hex');
  const decrypted = decrypt(data.encryptedKey, data.iv, salt, encryptionKey);
  
  if (decrypted.includes(' ')) {
    const account = mnemonicToAccount(decrypted);
    return { address: account.address, privateKey: decrypted };
  } else {
    return { address: data.address, privateKey: decrypted };
  }
}

export function getWalletAddress(): string | null {
  if (!fs.existsSync(getWalletPath())) {
    return null;
  }
  const data: WalletData = JSON.parse(fs.readFileSync(getWalletPath(), 'utf8'));
  return data.address;
}

export function walletExists(): boolean {
  return fs.existsSync(getWalletPath());
}
