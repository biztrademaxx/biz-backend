/**
 * PM2 config for small VPS (e.g. 512MB RAM).
 * Usage (from repo root on the server):
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 * After changing .env:  pm2 restart biz-backend --update-env
 */
module.exports = {
  apps: [
    {
      name: "biz-backend",
      script: "dist/server.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      // Cap RSS so the box keeps headroom for nginx / OS (tune if you add swap).
      max_memory_restart: "420M",
      node_args: "--max-old-space-size=384",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
