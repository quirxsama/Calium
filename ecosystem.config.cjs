/** @type {import('pm2').ModuleConfig} */
module.exports = {
  apps: [
    {
      name: "calium",
      script: "node_modules/.bin/next",
      args: "start",
      cwd: "/opt/calium",
      interpreter: "/home/quirxkaan/.nvm/versions/node/v20.20.2/bin/node",
      env_file: "/opt/calium/.env.local",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
    },
  ],
  deploy: {
    production: {
      user: "quirxkaan",
      host: "localhost",
      ref: "origin/main",
      repo: "git@github.com:quirxsama/Calium.git",
      path: "/opt/calium",
      "post-deploy": "npm install && npm run build && pm2 reload ecosystem.config.cjs --env production",
    },
  },
};
