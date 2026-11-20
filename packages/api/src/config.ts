const prod = process.env.NODE_ENV === 'production';
export const config = {
  port: Number(process.env.PANEL_PORT ?? 8080),
  host: process.env.PANEL_HOST ?? '127.0.0.1', // keep on localhost; nginx terminates TLS
  dbPath: process.env.PANEL_DB ?? './panel.db',
  helperSocket: process.env.HELPER_SOCKET ?? '/run/panel/helper.sock',
  secureCookies: (process.env.PANEL_SECURE_COOKIES ?? (prod ? '1' : '0')) === '1',
  sessionHours: 12,
  webDist: process.env.PANEL_WEB_DIST ?? new URL('../../web/dist/', import.meta.url).pathname,
};
