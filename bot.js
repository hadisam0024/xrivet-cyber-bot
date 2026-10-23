import {
  makeWASocket, DisconnectReason, useMultiFileAuthState,
  fetchLatestBaileysVersion, Browsers, makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { searchCyberRepos, formatPosts, filterNew } from './cyber.js';
import { handleGame, GAME_LIST } from './games.js';

const MENU_IMG = ['assets/menu.png', 'menu.png'].map(p => path.join(DATA_DIR, p)).find(p => { try { return fs.statSync(p).isFile(); } catch { return false; } });
function menuCard() {
  return {
    image: fs.readFileSync(MENU_IMG),
    caption: '🤖 *XRIVET CYBER* — pura menu upar tasveer me hai. Game khelne ke liye command bhejo!',
    contextInfo: {
      forwardingScore: 999,
      isForwarded: true,
      externalAdReply: {
        title: '⚡ XRIVET CYBER ⚡',
        body: 'System Online • Games + Cyber Repos',
        thumbnailUrl: 'https://xrivet-cyber-portal-k08m3ldc8.vercel.app/',
        sourceUrl: 'https://xrivet-cyber-portal-k08m3ldc8.vercel.app/',
        mediaType: 1,
        renderLargerThumbnail: true,
      },
    },
  };
}

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

// Scheduled job: GitHub sweep + jitne fresh mile, sab channel me post
export async function runCyberPost() {
  const repos = await searchCyberRepos(7, 10);
  const fresh = filterNew(repos);
  if (!fresh.length) {
    console.log('[bot] cyber post: nothing new');
    return { posted: 0 };
  }
  const jid = channelJidCache || await resolveChannelJid();
  if (!jid) throw new Error('CHANNEL_INVITE not set or could not resolve');
  const posts = formatPosts(fresh, 8);
  for (const p of posts) {
    await sock.sendMessage(jid, { text: p });
    await new Promise(r => setTimeout(r, 1500)); // flood se bachne ke liye gap
  }
  console.log(`[bot] cyber post: ${fresh.length} repos in ${posts.length} msgs -> ${jid}`);
  return { posted: fresh.length, messages: posts.length, jid };
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
        const [cmd, ...args] = text.slice(1).trim().split(/\s+/);
        const jid = msg.key.remoteJid;
        const reply = async (t) => sock.sendMessage(jid, { text: t }, { quoted: msg });
        const gameReply = handleGame(cmd, args);
        if (gameReply) { await reply(gameReply); continue; }
        if (cmd === 'ping') {
          const t0 = Date.now();
          await reply(`⚡ *${BOT_NAME} Ping* ⚡\n\n🛰️ ${(Date.now() - t0)} ms\n\nSystem Online ✅`);
        }
        else if (cmd === 'menu') { try { await sock.sendMessage(jid, menuCard(), { quoted: msg }); } catch { await reply('Menu image missing — .help likho'); } }
        else if (cmd === 'help')
          await reply(`🤖 *${BOT_NAME}*\n\n.ping — speed check\n.menu — fancy menu card\n.cyber — fresh cybersecurity repos now\n.postnow — post scheduled update now\n\n🎮 *GAMES*\n${GAME_LIST.map(g => g[0] + ' — ' + g[1]).join('\n')}`);
        else if (cmd === 'cyber') {
          const repos = await searchCyberRepos(7, 5);
          const fresh = filterNew(repos);
          const posts = formatPosts(fresh, 8);
          await reply(posts[0] || 'Nothing new right now.');
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
