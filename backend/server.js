const env = require('./src/config/env');
const dns = require("node:dns");

// Force Node.js to use public DNS servers to resolve MongoDB SRV records
dns.setServers(["8.8.8.8", "8.8.4.4"]);
const connectDB = require('./src/config/db');
const app = require('./src/app');
const { startCronJobs } = require('./src/jobs/cron');

async function bootstrap() {
  try {
    await connectDB();
    startCronJobs();
    app.listen(env.PORT, () => {
      console.log(`[ORGION API] Listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
    });
  } catch (err) {
    console.error('[ORGION API] Failed to start:', err);
    process.exit(1);
  }
}

bootstrap();
