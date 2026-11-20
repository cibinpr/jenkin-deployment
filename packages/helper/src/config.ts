export const config = {
  socketPath: process.env.HELPER_SOCKET ?? '/run/panel/helper.sock',
  socketGroup: process.env.HELPER_SOCKET_GROUP ?? 'panel',
  homeBase: process.env.PANEL_HOME_BASE ?? '/home',
  nginxAvailable: process.env.NGINX_AVAILABLE ?? '/etc/nginx/sites-available',
  nginxEnabled: process.env.NGINX_ENABLED ?? '/etc/nginx/sites-enabled',
  templatesDir: process.env.PANEL_TEMPLATES ?? new URL('../../../templates/', import.meta.url).pathname,
  phpSocket: process.env.PHP_FPM_SOCKET ?? '/run/php/php8.3-fpm.sock',
  maxFileBytes: 5 * 1024 * 1024,
};
