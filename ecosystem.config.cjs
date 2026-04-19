/** @type {import('pm2').ModuleConfig} */
module.exports = {
  apps: [
    {
      name: "calium",
      script: "node_modules/.bin/next",
      args: "start",
      cwd: "/opt/calium",
      interpreter: "/home/quirxkaan/.nvm/versions/node/v20.20.2/bin/node",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
    },
  ],
};
