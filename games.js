// XRIVET CYBER — text games (same style as classic WhatsApp game bots)
// Each game returns a single formatted reply string. No external deps.

const R = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[R(a.length)];

export function playSlot() {
  const s = ['🍒', '🍋', '🍇', '⭐', '💎', '7️⃣'];
  const a = pick(s), b = pick(s), c = pick(s);
  let res;
  if (a === b && b === c) res = '🏆 JACKPOT! Teenon mil gaye — kamaal!';
  else if (a === b || b === c || a === c) res = '✨ Do mil gaye! Chhoti jeet!';
  else res = '😅 Kuch nahi mila — phir try karo!';
  return `🎰 *SLOTS* 🎰\n\n| ${a} | ${b} | ${c} |\n\n${res}`;
}

export function playCoinflip(guess) {
  const side = pick(['Heads', 'Tails']);
  const emoji = side === 'Heads' ? '🪙' : '🔄';
  let res = `${emoji} *COINFLIP* ${emoji}\n\nResult: *${side}!*`;
  if (guess) {
    const g = guess.toLowerCase().startsWith('h') ? 'Heads' : guess.toLowerCase().startsWith('t') ? 'Tails' : null;
    if (g) res += g === side ? '\n\n🎉 Sahi guess — jeet gaye!' : `\n\n😅 Ghalat — ${side} aaya tha.`;
    else res += '\n\n(guess ke liye: .coinflip heads / .coinflip tails)';
  } else res += '\n\n(guess ke liye: .coinflip heads)';
  return res;
}

export function playBattle() {
  let you = 100, bot = 100;
  const log = [];
  const moves = ['⚔️ talwar ka waar', '🔥 aag ka hamla', '💥 zor ka mukka', '🗡️ chhupa khanjar', '⚡ bijli ki chaal'];
  let round = 0;
  while (you > 0 && bot > 0 && round < 12) {
    round++;
    const yd = 8 + R(13), bd = 8 + R(13);
    bot -= yd; you -= bd;
    log.push(`Round ${round}: Tumne ${yd} damage (${pick(moves)}) | Bot ne ${bd} damage`);
  }
  you = Math.max(0, you); bot = Math.max(0, bot);
  const win = you > bot;
  return `⚔️ *BATTLE* ⚔️\n\n🧑 Tum ❤️${you}  vs  🤖 Bot ❤️${bot}\n\n${log.join('\n')}\n\n${win ? '🏆 *TUM JEET GAYE!* Kamaal!' : bot > you ? '🤖 *Bot jeet gaya!* Badla lo — phir khelo!' : '🤝 *Draw!* Dono thak gaye!'}`;
}

export function playCarRace() {
  const LEN = 14;
  let p1 = 0, p2 = 0;
  const track = (p) => '▓'.repeat(p) + '🏎️💨' + '·'.repeat(Math.max(0, LEN - p));
  while (p1 < LEN && p2 < LEN) { p1 += 1 + R(3); p2 += 1 + R(3); }
  p1 = Math.min(p1, LEN); p2 = Math.min(p2, LEN);
  const win = p1 >= p2 && p1 > p2 ? 'TUM' : p2 > p1 ? 'BOT' : 'DRAW';
  return `🏁 *CAR RACE* 🏁\n\n🧑 Tum: ${track(p1)}🏁\n🤖 Bot: ${track(p2)}🏁\n\n${win === 'TUM' ? '🏆 *TUM JEET GAYE!* Speed king!' : win === 'BOT' ? '🤖 *Bot jeet gaya!* Race phir lagao!' : '🤝 *Draw!* Photo finish!'}`;
}

export function playTempleRun() {
  const dist = 200 + R(1800);
  const coins = R(dist / 8);
  const dodged = 3 + R(20);
  const events = ['🪨 pathar se bach gaye!', '🕳️ garhay me girte girte bache!', '🐒 bandar ne peecha kiya!', '🔥 aag ke jaal se nikle!', '🌉 tooti pul paar ki!'];
  const ev = [pick(events), pick(events)];
  const record = dist > 1500;
  return `🏃 *TEMPLE RUN* 🏃\n\n📏 Distance: *${dist}m*\n🪙 Coins: *${coins}*\n💨 Obstacles dodged: *${dodged}*\n\n${ev.join('\n')}\n\n${record ? '🏆 *NAYA RECORD!* Legend!' : '💪 Achhi run! Record ke liye phir daudo!'}`;
}

export function playCandy() {
  const c = ['🍬', '🍭', '🧁', '🍩', '🍪'];
  const rows = [];
  let matches = 0;
  for (let i = 0; i < 3; i++) {
    const row = [pick(c), pick(c), pick(c)];
    rows.push(row.join(' '));
    if (row[0] === row[1] && row[1] === row[2]) matches++;
  }
  return `🍬 *CANDY MATCH* 🍬\n\n${rows.join('\n')}\n\n${matches > 0 ? `🎉 *${matches} line${matches > 1 ? 's' : ''} match!* Meethi jeet!` : '😅 Koi line match nahi — phir try karo!'}\n\n(.candy se naya board)`;
}

// Returns reply string if cmd is a game, else null
export function handleGame(cmd, args) {
  switch (cmd) {
    case 'slot': return playSlot();
    case 'coinflip': return playCoinflip(args[0]);
    case 'battle': return playBattle();
    case 'carrace': return playCarRace();
    case 'templerun': return playTempleRun();
    case 'candy': return playCandy();
    default: return null;
  }
}

export const GAME_LIST = [
  ['.slot', 'Slot machine — jackpot lagao'],
  ['.coinflip', 'Heads ya tails — guess karo'],
  ['.battle', 'Bot se talwar-bazi'],
  ['.carrace', 'Racing — jeet ke dikhao'],
  ['.templerun', 'Daudo, coins jama karo'],
  ['.candy', 'Candy lines match karo'],
];
