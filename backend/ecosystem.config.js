// pm2 config for the VPS: pm2 start ecosystem.config.js
module.exports = {
  apps: [{
    name: 'smart-parking',
    script: 'server.js',
    cwd: __dirname,
    env: { PORT: 3000, HOST: '127.0.0.1', NODE_ENV: 'production' },
  }],
};
