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

// Search GitHub for fresh cybersecurity repos (created in last N days, top by stars)
export async function searchCyberRepos(daysBack = 7, perPage = 8) {
  const since = new Date(Date.now() - daysBack * 864e5).toISOString().slice(0, 10);
  const q = encodeURIComponent(`cybersecurity created:>${since}`);
  const url = `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=${perPage}`;
  const headers = {
    'User-Agent': 'xrivet-cyber-bot',
    'Accept': 'application/vnd.github+json',
  };
  if (process.env.GITHUB_TOKEN) headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  const { data } = await axios.get(url, { headers, timeout: 20000 });
  return (data.items || []).map(r => ({
    fullName: r.full_name,
    url: r.html_url,
    desc: (r.description || 'No description').slice(0, 140),
    stars: r.stargazers_count,
    lang: r.language || 'n/a',
  }));
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

// Returns { posted, skipped } — only posts repos never posted before
export function filterNew(repos) {
  const posted = loadPosted();
  const fresh = repos.filter(r => !posted.has(r.fullName));
  fresh.forEach(r => posted.add(r.fullName));
  if (fresh.length) savePosted(posted);
  return fresh;
}
