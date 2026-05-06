const cluster = require('cluster');
const os = require('os');

const workers = Math.max(1, Number(process.env.CLUSTER_WORKERS || os.cpus().length));
const shutdownTimeoutMs = Math.max(1000, Number(process.env.CLUSTER_SHUTDOWN_TIMEOUT_MS || 15000));

if (cluster.isPrimary) {
  console.log(`🧩 Master ${process.pid} iniciando ${workers} workers`);

  for (let i = 0; i < workers; i += 1) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.warn(`⚠️ Worker ${worker.process.pid} salió (code=${code}, signal=${signal}). Reiniciando...`);
    cluster.fork();
  });

  const gracefulExit = () => {
    console.log('🛑 Cierre graceful de cluster solicitado');
    for (const id of Object.keys(cluster.workers || {})) {
      cluster.workers[id]?.kill('SIGTERM');
    }

    setTimeout(() => {
      process.exit(0);
    }, shutdownTimeoutMs).unref();
  };

  process.on('SIGINT', gracefulExit);
  process.on('SIGTERM', gracefulExit);
} else {
  require('./index');
}
