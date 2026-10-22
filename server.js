import 'dotenv/config';
import express from 'express';
import { getStatus, getQr, requestPairingCode, runCyberPost } from './bot.js';

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const INTERVAL_H = parseFloat(process.env.POST_INTERVAL_HOURS || '12');

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'xrivet-cyber-bot', ...getStatus(), time: new Date().toISOString() });
});

// QR pairing page (Hadi connects his own WhatsApp)
app.get('/', (req, res) => {
  const s = getStatus();
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${s.bot} — Pair WhatsApp</title>
<style>body{font-family:system-ui;background:#0a0e1a;color:#e8ecf4;display:flex;flex-direction:column;align-items:center;padding:40px 20px}
.card{background:#131a2e;border:1px solid #1f2942;border-radius:14px;padding:28px;max-width:420px;text-align:center}
img{width:280px;height:280px;border-radius:8px;background:#fff;margin:16px 0}.ok{color:#34d399}.warn{color:#fbbf24}
input,button{padding:10px 14px;border-radius:8px;border:1px solid #1f2942;margin:4px;font-size:15px}
button{background:#22d3ee;border:none;font-weight:700;cursor:pointer}input{background:#0d1322;color:#fff;width:200px}</style></head>
<body><div class="card"><h2>🤖 ${s.bot}</h2>
${s.status === 'open'
  ? `<p class="ok">✅ WhatsApp connected</p><p>Channel: ${s.channel || 'not set (CHANNEL_INVITE env)'}</p>`
  : `<p class="warn">Scan this QR in WhatsApp → Linked devices:</p><img src="/api/qr" alt="QR"><p>or pair with code:</p>
     <form action="/api/pair" method="get"><input name="phone" placeholder="923001234567" required><button>Send code</button></form>`}
<p style="font-size:12px;color:#8b93a7">Posts trending cybersecurity GitHub repos to your channel every ${INTERVAL_H}h.</p>
</div></body></html>`);
});

app.get('/api/qr', (req, res) => {
  const qr = getQr();
  if (!qr) return res.status(404).send('no QR right now (already connected?)');
  res.send(`<img src="${qr}" style="width:300px">`);
});

app.get('/api/pair', async (req, res) => {
  try {
    const code = await requestPairingCode(req.query.phone || '');
    res.send(`<h2>Pairing code: <b>${code}</b></h2><p>WhatsApp → Linked devices → Link with phone number</p>`);
  } catch (e) { res.status(500).send('error: ' + e.message); }
});

// Manual trigger (admin password)
app.post('/api/post-now', express.json(), async (req, res) => {
  if (ADMIN_PASSWORD && req.body?.password !== ADMIN_PASSWORD)
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  try { res.json({ ok: true, ...(await runCyberPost()) }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.listen(PORT, () => console.log(`[server] listening on ${PORT}`));

// Scheduler: post every INTERVAL_H hours (skip if WhatsApp/channel not ready)
setInterval(async () => {
  try { await runCyberPost(); }
  catch (e) { console.log('[scheduler] skipped:', e.message); }
}, INTERVAL_H * 3600 * 1000);
console.log(`[scheduler] every ${INTERVAL_H}h`);
