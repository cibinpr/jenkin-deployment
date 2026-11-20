import net from 'node:net';
import { config } from './config.js';

export class HelperError extends Error {}

export function callHelper<T = any>(action: string, params: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection(config.helperSocket);
    let buf = '';
    sock.setEncoding('utf8');
    sock.setTimeout(300_000, () => { sock.destroy(); reject(new HelperError('Helper timeout')); });
    sock.on('connect', () => sock.write(JSON.stringify({ action, params }) + '\n'));
    sock.on('data', (c) => (buf += c));
    sock.on('error', (e) => reject(new HelperError('Helper unavailable: ' + e.message)));
    sock.on('close', () => {
      try {
        const res = JSON.parse(buf);
        res.ok ? resolve(res.data) : reject(new HelperError(res.error ?? 'Helper error'));
      } catch {
        reject(new HelperError('Bad helper response'));
      }
    });
  });
}
