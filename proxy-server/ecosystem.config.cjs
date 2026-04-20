/** @type {import('pm2').ModuleConfig} */
module.exports = {
  apps: [
    {
      name: "anizium-proxy",
      script: "index.mjs",
      cwd: "/opt/anizium-proxy",
      env: {
        NODE_ENV: "production",
        PORT: 3002,
        PROXY_API_KEY: "BURAYA_RASTGELE_BIR_KEY_YAZ",
      },
    },
  ],
};
