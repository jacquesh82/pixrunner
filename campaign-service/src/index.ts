import express from 'express';
import cors from 'cors';
import { env } from './env.js';
import { authRouter } from './routes/auth.js';
import { merchantRouter } from './routes/merchant.js';
import { campaignRouter } from './routes/campaigns.js';
import { redemptionRouter } from './routes/redemptions.js';
import { insightsRouter } from './routes/insights.js';
import { cosmeticRouter } from './routes/cosmetics.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'campaign-service' });
});

app.use('/auth', authRouter);
app.use('/merchant', merchantRouter);
app.use('/campaigns', campaignRouter);
app.use('/redemptions', redemptionRouter);
app.use('/insights', insightsRouter);
app.use('/cosmetics', cosmeticRouter);

app.listen(env.port, () => {
  console.log(`[campaign-service] à l'écoute sur :${env.port}`);
});
