// Xác Suất AI: static files + /api/ai (Gemini proxy, key stays here) + /api/forum (JSON file).
// No dependencies; needs Node >= 20.12.
const http = require('http'), fs = require('fs'), path = require('path');
try { process.loadEnvFile() } catch {} // reads .env if present

const PORT = process.env.PORT || 3000;
const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.MODEL || 'gemini-3.5-flash';
const PER_MIN = +process.env.RATE_PER_MIN || 15;     // per IP
const PER_DAY = +process.env.DAILY_LIMIT || 500;     // whole site, protects your API bill
const PUB = path.join(__dirname, 'public');
const FORUM = path.join(__dirname, 'data', 'forum.json');

const SYS = `Bạn là gia sư Xác suất Thống kê cho học sinh, sinh viên Việt Nam. Trả lời bằng tiếng Việt, ngắn gọn, chính xác. Viết ký hiệu toán bằng Unicode thuần (P(A∩B), x̄, σ², ∑, √, ≤), không dùng LaTeX. Với bài tập: chỉ đưa chiến lược, câu hỏi gợi mở, công thức cần dùng; KHÔNG viết lời giải đầy đủ và KHÔNG nêu đáp số cuối cùng.`;
const VOICE = `\nĐây là hội thoại bằng giọng nói: trả lời ngắn (tối đa 120 từ), dễ nghe. Nếu câu hỏi cần trình bày công thức hoặc bài giải dài, bảo học sinh viết lên bảng và gửi lại.`;
const JSON_ONLY = `\n\nChỉ trả về JSON hợp lệ, không thêm chữ nào khác, không bọc trong khối mã.`;

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const hits = new Map(); let day = { d: '', n: 0 };

const send = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)) };
const body = (req, max = 15e6) => new Promise((ok, no) => {
  let b = '', n = 0;
  req.on('data', c => { n += c.length; if (n > max) { no(new Error('Dữ liệu quá lớn')); req.destroy() } else b += c });
  req.on('end', () => { try { ok(JSON.parse(b || '{}')) } catch { no(new Error('JSON không hợp lệ')) } });
});

function allow(req) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const now = Date.now(), t = (hits.get(ip) || []).filter(x => now - x < 6e4);
  if (t.length >= PER_MIN) return 'Bạn gửi quá nhanh, thử lại sau một phút.';
  const today = new Date().toISOString().slice(0, 10);
  if (day.d !== today) day = { d: today, n: 0 };
  if (day.n >= PER_DAY) return 'Hôm nay hệ thống đã hết lượt dùng AI, mai thử lại.';
  t.push(now); hits.set(ip, t); day.n++;
  return '';
}

// Gemini "parts": text plus optional inline images
function toParts(text, images) {
  const imgs = (images || []).slice(0, 5).map(u => {
    const m = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(u || '');
    if (!m) throw new Error('Ảnh không hợp lệ');
    return { inlineData: { mimeType: m[1], data: m[2] } };
  });
  return [...imgs, { text }];
}

async function handleAI(req, res) {
  if (!KEY) return send(res, 500, { error: 'Server chưa có GEMINI_API_KEY (xem README).' });
  const why = allow(req); if (why) return send(res, 429, { error: why });
  const { prompt, messages, json, images, voice } = await body(req);
  let contents;
  if (Array.isArray(messages)) {
    contents = messages.slice(-20).map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content).slice(0, 4000) }] }));
    if (!contents.length || contents.at(-1).role !== 'user') return send(res, 400, { error: 'Tin nhắn cuối phải của người dùng' });
    if (images?.length) contents.at(-1).parts = toParts(contents.at(-1).parts[0].text, images);
  } else {
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 12000) return send(res, 400, { error: 'Câu hỏi trống hoặc quá dài' });
    contents = [{ role: 'user', parts: toParts(prompt + (json ? JSON_ONLY : ''), images) }];
  }
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': KEY, 'content-type': 'application/json' },
    signal: AbortSignal.timeout(60000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYS + (voice ? VOICE : '') }] },
      contents,
      generationConfig: { maxOutputTokens: 8192, ...(json && { responseMimeType: 'application/json' }) },
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return send(res, 502, { error: 'Lỗi từ Gemini: ' + (d.error?.message || r.status) });
  const cand = d.candidates?.[0];
  if (!cand) return send(res, 502, { error: 'Gemini không trả kết quả' + (d.promptFeedback?.blockReason ? ' (' + d.promptFeedback.blockReason + ')' : '') });
  let text = (cand.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('');
  if (json) { const a = text.indexOf('{'), b = text.lastIndexOf('}'); if (a >= 0 && b > a) text = text.slice(a, b + 1) }
  send(res, 200, { text });
}

const readForum = () => { try { return JSON.parse(fs.readFileSync(FORUM, 'utf8')) } catch { return [] } };
async function handleForum(req, res) {
  if (req.method === 'GET') return send(res, 200, readForum());
  const { name, text, parent } = await body(req, 20e3);
  if (typeof text !== 'string' || !text.trim() || text.length > 1500) return send(res, 400, { error: 'Nội dung trống hoặc quá dài' });
  const posts = readForum();
  if (parent && !posts.some(p => p.id === parent && !p.parent)) return send(res, 400, { error: 'Bài gốc không tồn tại' });
  const ts = Date.now();
  posts.push({ id: ts.toString(36) + Math.random().toString(36).slice(2, 6), name: String(name || 'Ẩn danh').slice(0, 30), text: text.trim(), ts, ...(parent && { parent }) });
  fs.mkdirSync(path.dirname(FORUM), { recursive: true });
  fs.writeFileSync(FORUM, JSON.stringify(posts.slice(-500))); // ponytail: JSON file; use SQLite/Postgres if many users
  send(res, 200, { ok: true });
}

function serveStatic(req, res) {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(PUB, p);
  if (!f.startsWith(PUB + path.sep)) { res.writeHead(403); return res.end() }
  fs.readFile(f, (e, buf) => {
    if (e) { res.writeHead(404); return res.end('Not found') }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(buf);
  });
}

http.createServer(async (req, res) => {
  try {
    const u = req.url.split('?')[0];
    if (u === '/api/ai' && req.method === 'POST') return await handleAI(req, res);
    if (u === '/api/forum' && ['GET', 'POST'].includes(req.method)) return await handleForum(req, res);
    if (req.method === 'GET') return serveStatic(req, res);
    res.writeHead(405); res.end();
  } catch (e) { if (!res.headersSent) send(res, 500, { error: e.message }) }
}).listen(PORT, () => console.log(`Xác Suất AI: http://localhost:${PORT}${KEY ? '' : '  (thiếu GEMINI_API_KEY)'}`));
