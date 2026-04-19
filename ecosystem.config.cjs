/** @type {import('pm2').ModuleConfig} */
module.exports = {
  apps: [
    {
      name: "calium",
      script: "node_modules/.bin/next",
      args: "start",
      cwd: "/opt/calium",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
