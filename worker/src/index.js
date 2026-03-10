import Redis from 'ioredis';
import Docker from 'dockerode';
import fs from 'node:fs/promises';
import path from 'node:path';

const JOBS_DIR = process.env.JOBS_DIR || '/data/jobs';
const HOST_JOBS_DIR = process.env.HOST_JOBS_DIR || JOBS_DIR;
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const PARSER_IMAGE = process.env.PARSER_IMAGE || 'dht-parser:latest';
const CONTAINER_TIMEOUT = 30_000;

const redis = new Redis(REDIS_URL);
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

async function processJob(jobId) {
  const jobDir = path.join(JOBS_DIR, jobId);
  const outputPath = path.join(jobDir, 'output.json');

  await redis.hset(`job:${jobId}`, 'status', 'processing');

  const container = await docker.createContainer({
    Image: PARSER_IMAGE,
    Cmd: ['/work/input.pdf', '/work/output.json'],
    HostConfig: {
      Binds: [`${path.join(HOST_JOBS_DIR, jobId)}:/work`],
      Memory: 512 * 1024 * 1024,
      MemorySwap: 512 * 1024 * 1024,
      NanoCpus: 1_000_000_000, // 1 CPU
      NetworkMode: 'none',
      ReadonlyRootfs: true,
      CapDrop: ['ALL'],
      SecurityOpt: ['no-new-privileges'],
      Tmpfs: { '/tmp': 'size=64m' },
    },
    User: '10001:10001',
  });

  await container.start();

  // Enforce timeout
  const timeout = setTimeout(async () => {
    try {
      await container.kill();
    } catch {
      // container may have already exited
    }
  }, CONTAINER_TIMEOUT);

  try {
    const { StatusCode } = await container.wait();
    clearTimeout(timeout);

    if (StatusCode !== 0) {
      const logs = await container.logs({ stderr: true, stdout: true });
      throw new Error(`Parser exited with code ${StatusCode}: ${logs.toString()}`);
    }

    const result = await fs.readFile(outputPath, 'utf-8');
    // Validate JSON before storing
    JSON.parse(result);
    await redis.hset(`job:${jobId}`, 'status', 'done', 'result', result);
  } finally {
    await container.remove({ force: true }).catch(() => {});
    await fs.rm(jobDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function poll() {
  console.log('Worker ready, waiting for jobs...');

  while (true) {
    try {
      // BRPOP blocks until a job is available (5s timeout to allow graceful shutdown)
      const item = await redis.brpop('pdf:queue', 5);
      if (!item) continue;

      const jobId = item[1];
      console.log(`Processing job ${jobId}`);

      try {
        await processJob(jobId);
        console.log(`Job ${jobId} done`);
      } catch (err) {
        console.error(`Job ${jobId} failed:`, err.message);
        await redis.hset(`job:${jobId}`, 'status', 'failed', 'error', err.message);
      }
    } catch (err) {
      console.error('Poll error:', err.message);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

poll();
