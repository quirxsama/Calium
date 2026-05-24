/** @type {import('pm2').ModuleConfig} */
module.exports = {
  apps: [
    {
      name: "calium",
      script: "server.mjs",
      cwd: "/root/Calium",
      interpreter: "/usr/bin/node",
      env_file: "/root/Calium/.env.local",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
        HOSTNAME: "0.0.0.0",
      },
    },
  ],
  deploy: {
    production: {
      user: "quirxkaan",
      host: "localhost",
      ref: "origin/main",
      repo: "git@github.com:quirxsama/Calium.git",
      path: "/root/Calium",
      "post-deploy": "npm install && npm run build && pm2 reload ecosystem.config.cjs --env production",
    },
  },
};
