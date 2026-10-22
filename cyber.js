import fs from 'fs';
import path from 'path';
import axios from 'axios';

const DATA_DIR = process.env.DATA_DIR || '.';
const POSTED_FILE = path.join(DATA_DIR, 'posted.json');

function loadPosted() {
  try { return new Set(JSON.parse(fs.readFileSync(POSTED_FILE, 'utf-8'))); }
  catch { return new Set(); }
}
function savePosted(set) {
  try { fs.writeFileSync(POSTED_FILE, JSON.stringify([...set].slice(-500))); } catch {}
}

// Broad sweep: poori GitHub se cybersecurity topics (narrow single-query nahi)
const QUERIES = [
  'cybersecurity', 'infosec', 'threat-intelligence',
  'malware-analysis', 'penetration-testing', 'cve scanner',
];
const SWEEP_FILE = path.join(DATA_DIR, 'sweep.json');
const MAX_PAGES = 10; // GitHub search caps at 1000 results anyway

function loadSweep() {
  try { return JSON.parse(fs.readFileSync(SWEEP_FILE, 'utf-8')); }
  catch { return { pages: {} }; }
}
function saveSweep(s) {
  try { fs.writeFileSync(SWEEP_FILE, JSON.stringify(s)); } catch {}
}

// Har cycle me har topic ka AGLA page uthata hai — coverage sweep hoti rehti hai,
// sirf top-8 repeat nahi hote. "Jitne bhi hain" ke liye yehi tareeqa hai.
export async function searchCyberRepos(daysBack = 7, perQuery = 10) {
  const since = new Date(Date.now() - daysBack * 864e5).toISOString().slice(0, 10);
  const headers = {
    'User-Agent': 'xrivet-cyber-bot',
    'Accept': 'application/vnd.github+json',
  };
  if (process.env.GITHUB_TOKEN) headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  const sweep = loadSweep();
  const all = [];
  for (const q of QUERIES) {
    const page = sweep.pages[q] || 1;
    try {
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q + ' created:>' + since)}&sort=stars&order=desc&per_page=${perQuery}&page=${page}`;
      const { data } = await axios.get(url, { headers, timeout: 20000 });
      (data.items || []).forEach(r => all.push({
        fullName: r.full_name,
        url: r.html_url,
        desc: (r.description || 'No description').slice(0, 140),
        stars: r.stargazers_count,
        lang: r.language || 'n/a',
      }));
    } catch (e) { console.log('[cyber] query failed:', q, '-', e.message); }
    sweep.pages[q] = page >= MAX_PAGES ? 1 : page + 1;
  }
  saveSweep(sweep);
  const seen = new Set();
  return all
    .filter(r => !seen.has(r.fullName) && (seen.add(r.fullName), true))
    .sort((a, b) => b.stars - a.stars);
}

export function formatPost(repos) {
  const lines = ['🛡️ *CYBER WATCH* 🛡️', '_Fresh cybersecurity repos on GitHub_', ''];
  repos.forEach((r, i) => {
    const num = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣'][i] || `${i + 1}.`;
    lines.push(`${num} *${r.fullName}*  ⭐ ${r.stars.toLocaleString()}  \`${r.lang}\``);
    lines.push(`_${r.desc}_`);
    lines.push(`🔗 ${r.url}`, '');
  });
  lines.push('_Powered by XRIVET Cyber Bot 🤖_');
  return lines.join('\n');
}

// Lambi list ko 8-repo ke chunks me baantta hai — ek message me sab nahi thonsta
export function formatPosts(repos, chunkSize = 8) {
  const chunks = [];
  for (let i = 0; i < repos.length; i += chunkSize) chunks.push(repos.slice(i, i + chunkSize));
  return chunks.map((c, idx) =>
    (chunks.length > 1 ? `🛡️ *CYBER WATCH* (part ${idx + 1}/${chunks.length}) 🛡️\n_Fresh cybersecurity repos on GitHub_\n\n` : '') +
    (chunks.length > 1
      ? c.map((r, i) => `${i + 1 + idx * chunkSize}. *${r.fullName}*  ⭐ ${r.stars.toLocaleString()}  \`${r.lang}\`\n_${r.desc}_\n🔗 ${r.url}`).join('\n\n')
      : formatPost(c))
  );
}

// Returns { posted, skipped } — only posts repos never posted before
export function filterNew(repos) {
  const posted = loadPosted();
  const fresh = repos.filter(r => !posted.has(r.fullName));
  fresh.forEach(r => posted.add(r.fullName));
  if (fresh.length) savePosted(posted);
  return fresh;
}
