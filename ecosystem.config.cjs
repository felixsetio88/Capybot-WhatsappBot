module.exports = {
  apps: [
    {
      name: 'capybot',
      script: 'src/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '450M',
      restart_delay: 2000,
      exp_backoff_restart_delay: 100,
      max_restarts: 50,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      node_args: '--max-old-space-size=450',
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
