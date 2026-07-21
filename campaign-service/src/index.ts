import express from 'express';
import cors from 'cors';
import { env } from './env.js';
import { authRouter } from './routes/auth.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'campaign-service' });
});

app.use('/auth', authRouter);

app.listen(env.port, () => {
  console.log(`[campaign-service] à l'écoute sur :${env.port}`);
});
