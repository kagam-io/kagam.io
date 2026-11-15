// お問い合わせフォームの受け付け (Cloudflare Workers)
//   POST /api/contact  { name, email, message, leave_empty (わな), elapsed, 'cf-turnstile-response' }
//   中身を確かめて、Email Routing で自分宛てにメールを送る。
// 外とやりとりする処理は worker.js から渡す (テストや手元の確認で差し替えられるように)
//   send(mail)          … メールを送る
//   limit(ip)           … 送信回数の制限。超えていたら false (省略可)
//   verify(token, ip)   … Turnstile の人間確認。通らなければ false (省略可)

const LIMITS = { name: 60, email: 120, message: 3000 };
const MIN_FILL_MS = 3000; // 開いてからこれより早い送信はロボットとみなす

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

const oneLine = s => String(s ?? '').replace(/[\r\n]+/g, ' ').trim(); // ヘッダーに改行を入れさせない
const isEmail = s => /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/.test(s);

// UTF-8 の文字列を base64 に
const b64 = s => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

export function buildMail({ from, to, name, email, message, now = new Date() }) {
  const subject = `[kagam.io] ${name || '名前なし'} さんからのメッセージ`;
  const body = [
    `名前: ${name || '（なし）'}`,
    `返信先: ${email || '（なし）'}`,
    `日時: ${now.toISOString()}`,
    '',
    message,
  ].join('\n');
  const headers = [
    `From: kagam.io <${from}>`,
    `To: <${to}>`,
    ...(email ? [`Reply-To: <${email}>`] : []),
    `Subject: =?UTF-8?B?${b64(subject)}?=`,
    `Date: ${now.toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${from.split('@')[1]}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ];
  return headers.join('\r\n') + '\r\n\r\n' + b64(body).replace(/.{1,76}/g, '$&\r\n');
}

export async function handleContact(request, { from, to, send, limit, verify }) {
  if (request.method !== 'POST') return json(405, { ok: false, error: 'method' });
  if (!to) return json(500, { ok: false, error: 'config' }); // 届け先 (シークレット CONTACT_TO) が未設定
  if (Number(request.headers.get('Content-Length') || 0) > 20000) return json(413, { ok: false, error: 'too-long' });
  const ip = request.headers.get('CF-Connecting-IP') || '';

  // 同じ送り元から短い間に何通も送れないようにする
  if (limit && !(await limit(ip))) return json(429, { ok: false, error: 'rate' });

  let data;
  try {
    data = await request.json();
  } catch {
    return json(400, { ok: false, error: 'invalid' });
  }
  // わなの欄が埋まっている・早すぎる → 受け付けたふりをして何もしない
  // elapsed はページを開いてからの経過時間 (ブラウザの中だけで測る。端末の時計がずれていても狂わない)
  if (data.leave_empty || !(Number(data.elapsed) >= MIN_FILL_MS)) return json(200, { ok: true });

  // Turnstile (目に見えない人間確認)
  if (verify && !(await verify(String(data['cf-turnstile-response'] || ''), ip))) {
    return json(403, { ok: false, error: 'captcha' });
  }

  const name = oneLine(data.name).slice(0, LIMITS.name);
  const email = oneLine(data.email).slice(0, LIMITS.email);
  const message = String(data.message ?? '').trim();
  if (!message) return json(400, { ok: false, error: 'empty' });
  if (message.length > LIMITS.message) return json(400, { ok: false, error: 'too-long' });
  if (email && !isEmail(email)) return json(400, { ok: false, error: 'email' });

  try {
    await send({ from, to, raw: buildMail({ from, to, name, email, message }) });
  } catch (e) {
    console.error('contact send failed', e);
    return json(502, { ok: false, error: 'send' });
  }
  return json(200, { ok: true });
}

// Turnstile のトークンを Cloudflare に確かめてもらう
export async function verifyTurnstile(secret, token, ip, fetchImpl = fetch) {
  if (!token) return false;
  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);
  const res = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  const out = await res.json().catch(() => ({}));
  return out.success === true;
}
