import {
  makeWASocket, DisconnectReason, useMultiFileAuthState,
  fetchLatestBaileysVersion, Browsers, makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { searchCyberRepos, formatPost, filterNew } from './cyber.js';

const DATA_DIR = process.env.DATA_DIR || '.';
const AUTH_DIR = path.join(DATA_DIR, 'sessions');
fs.mkdirSync(AUTH_DIR, { recursive: true });

const logger = pino({ level: 'silent' });
const BOT_NAME = process.env.BOT_NAME || 'XRIVET CYBER';

let sock = null;
let qrDataUrl = null;
let connectionStatus = 'connecting';
let channelJidCache = null;

// Resolve WhatsApp channel invite link -> newsletter JID (cached on disk)
async function resolveChannelJid() {
  const raw = (process.env.CHANNEL_INVITE || '').trim();
  if (!raw) return null;
  if (raw.endsWith('@newsletter')) return raw;
  const cacheFile = path.join(DATA_DIR, 'channel_jid.txt');
  try {
    const cached = fs.readFileSync(cacheFile, 'utf-8').trim();
    if (cached) { channelJidCache = cached; return cached; }
  } catch {}
  const m = raw.match(/whatsapp\.com\/channel\/([A-Za-z0-9]+)/);
  const inviteCode = m ? m[1] : raw;
  if (!sock) return null;
  const metadata = await sock.newsletterMetadata('invite', inviteCode);
  const jid = metadata?.id;
  if (jid) {
    channelJidCache = jid;
    try { fs.writeFileSync(cacheFile, jid); } catch {}
    console.log(`[bot] channel resolved: ${metadata.name} -> ${jid}`);
  }
  return jid || null;
}

export async function postToChannel(text) {
  if (!sock || connectionStatus !== 'open') throw new Error('WhatsApp not connected');
  const jid = channelJidCache || await resolveChannelJid();
  if (!jid) throw new Error('CHANNEL_INVITE not set or could not resolve');
  await sock.sendMessage(jid, { text });
  return jid;
}

// Scheduled job: search GitHub + post fresh repos to the channel
export async function runCyberPost() {
  const repos = await searchCyberRepos(7, 8);
  const fresh = filterNew(repos);
  if (!fresh.length) {
    console.log('[bot] cyber post: nothing new');
    return { posted: 0 };
  }
  const jid = await postToChannel(formatPost(fresh));
  console.log(`[bot] cyber post: ${fresh.length} repos -> ${jid}`);
  return { posted: fresh.length, jid };
}

async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({
    version,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    logger,
    browser: Browsers.macOS('Desktop'),
    printQRInTerminal: true,
  });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr) {
      try { qrDataUrl = await QRCode.toDataURL(qr); } catch {}
      connectionStatus = 'qr';
    }
    if (connection === 'open') {
      connectionStatus = 'open';
      qrDataUrl = null;
      console.log('[bot] WhatsApp connected ✅');
    }
    if (connection === 'close') {
      connectionStatus = 'connecting';
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log('[bot] connection closed, code:', code);
      if (code !== DisconnectReason.loggedOut) setTimeout(connect, 8000);
      else console.log('[bot] LOGGED OUT — delete sessions/ and re-pair');
    }
  });

  // Minimal commands (private bot)
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      try {
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        if (!text.startsWith('.') || msg.key.fromMe) continue;
        const [cmd] = text.slice(1).trim().split(/\s+/);
        const jid = msg.key.remoteJid;
        const reply = async (t) => sock.sendMessage(jid, { text: t }, { quoted: msg });
        if (cmd === 'ping') await reply('🏓 pong — ' + BOT_NAME + ' online');
        else if (cmd === 'help' || cmd === 'menu')
          await reply(`🤖 *${BOT_NAME}*\n\n.ping — check alive\n.cyber — fresh cybersecurity repos now\n.postnow — post scheduled update now`);
        else if (cmd === 'cyber') {
          const repos = await searchCyberRepos(7, 5);
          await reply(formatPost(filterNew(repos)) || 'Nothing new right now.');
        }
        else if (cmd === 'postnow') {
          const r = await runCyberPost();
          await reply(r.posted ? `✅ Posted ${r.posted} repos to channel` : 'ℹ️ Nothing new to post');
        }
      } catch (e) { console.error('[bot] cmd error:', e.message); }
    }
  });
}

export function getStatus() {
  return { status: connectionStatus, bot: BOT_NAME, qr: !!qrDataUrl, channel: channelJidCache };
}
export function getQr() { return qrDataUrl; }
export async function requestPairingCode(phone) {
  if (!sock) throw new Error('socket not ready');
  return await sock.requestPairingCode(phone.replace(/\D/g, ''));
}

connect();
