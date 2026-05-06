/**
 * PM2 Ecosystem Configuration for Hostinger
 * 
 * Uso:
 * pm2 start ecosystem.config.js                    # Iniciar en producción
 * pm2 start ecosystem.config.js --env development  # Iniciar en desarrollo
 * pm2 logs bot-irrigacion                           # Ver logs en tiempo real
 * pm2 monit                                         # Monitor de procesos
 */

module.exports = {
  apps: [
    {
      // Nombre de la aplicación
      name: 'bot-irrigacion',
      
      // Script a ejecutar
      script: './src/index.js',
      
      // Argumentos (ninguno por ahora)
      args: '',
      
      // Número de instancias (2 para balance de carga)
      instances: 2,
      
      // Tipo de ejecución (cluster para aprovechar múltiples CPUs)
      exec_mode: 'cluster',
      
      // Reiniciar si usa más de 500MB RAM
      max_memory_restart: '500M',
      
      // Environment variables por environment
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        MAX_BROWSERS: '3',
        DB_CONNECTION_LIMIT: '50'
      },
      
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
        MAX_BROWSERS: '2',
        DB_CONNECTION_LIMIT: '10'
      },
      
      // Logs
      log_file: './logs/pm2.log',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      time: true,
      
      // Reinicio automático
      watch: false, // No usar en producción
      ignore_watch: ['node_modules', 'logs', 'public/uploads'],
      
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      
      // Reintentos
      max_restarts: 10,
      min_uptime: '10s',
      
      // Eventos de muerte
      listen_timeout: 3000,
      shutdown_with_message: true
    }
  ],
  
  // Deploy config (para despliegue automático con git)
  deploy: {
    production: {
      user: 'hostinger_user',
      host: 'tu-dominio.com',
      ref: 'origin/main',
      repo: 'https://github.com/LL1121/nuevo-bot-irrigacion.git',
      path: '/home/tu-usuario/bot-irrigacion',
      
      // Comando post-deploy
      'post-deploy': 'npm install && npm run build && pm2 restart ecosystem.config.js',
      
      // Comando pre-deploy
      'pre-deploy-local': 'echo "Deploying to production"'
    }
  }
};
