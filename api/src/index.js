import express from 'express';
import multer from 'multer';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const JOBS_DIR = process.env.JOBS_DIR || '/data/jobs';
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const PORT = process.env.PORT || 3000;

const redis = new Redis(REDIS_URL);
const app = express();

const __dirname = path.dirname(new URL(import.meta.url).pathname);
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({
  dest: '/tmp/uploads',
  limits: { fileSize: MAX_FILE_SIZE },
});

app.post('/jobs', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fd = await fs.open(req.file.path, 'r');
    const buf = Buffer.alloc(5);
    await fd.read(buf, 0, 5, 0);
    await fd.close();

    if (buf.toString('ascii', 0, 5) !== '%PDF-') {
      await fs.unlink(req.file.path);
      return res.status(400).json({ error: 'File is not a valid PDF' });
    }

    // Create job directory and move file
    const jobId = randomUUID();
    const jobDir = path.join(JOBS_DIR, jobId);
    await fs.mkdir(jobDir, { recursive: true });
    await fs.copyFile(req.file.path, path.join(jobDir, 'input.pdf'));
    await fs.unlink(req.file.path);

    // Queue job
    await redis.hset(`job:${jobId}`, 'status', 'queued');
    await redis.lpush('pdf:queue', jobId);

    res.status(202).json({ jobId });
  } catch (err) {
    // Clean up temp file on error
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    console.error('POST /jobs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/jobs/:id', async (req, res) => {
  const jobId = req.params.id;
  const data = await redis.hgetall(`job:${jobId}`);

  if (!data || !data.status) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const response = { jobId, status: data.status };

  if (data.status === 'done') {
    response.result = JSON.parse(data.result);
  } else if (data.status === 'failed') {
    response.error = data.error;
  }

  res.json(response);
});

app.listen(PORT, () => {
  console.log(`API listening on :${PORT}`);
});
