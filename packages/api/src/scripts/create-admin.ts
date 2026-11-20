import { authenticator } from 'otplib';
import { db } from '../db/index.js';
import { hashPassword } from '../lib/auth.js';

// usage: npm run create-admin -w @mypanel/api -- <username> <password> [--totp]
const [username, password, flag] = process.argv.slice(2);
if (!username || !password || password.length < 12) {
  console.error('Usage: create-admin <username> <password (min 12 chars)> [--totp]');
  process.exit(1);
}
const secret = flag === '--totp' ? authenticator.generateSecret() : null;
db.prepare("INSERT INTO users (username, password_hash, role, totp_secret) VALUES (?,?, 'admin', ?)").run(username, await hashPassword(password), secret);
console.log(`Admin "${username}" created.`);
if (secret) console.log(`TOTP secret (add to your authenticator app): ${secret}\nURI: ${authenticator.keyuri(username, 'MyPanel', secret)}`);
