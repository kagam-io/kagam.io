// Cloudflare Workers の入口。
//   /api/timeline … 手書きの項目 (assets/data/timeline.json) と Zenn の記事を混ぜて返す (1時間キャッシュ)
//   /api/contact  … お問い合わせフォームの内容を、Email Routing で自分宛てにメールする
//   それ以外       … このフォルダの静的ファイル (HTML / 画像など) をそのまま返す
import { EmailMessage } from 'cloudflare:email';
import { buildTimeline } from './timeline.js';
import { handleContact, verifyTurnstile } from './contact.js';

const CACHE_SECONDS = 3600;

// API の応答に付けるセキュリティのヘッダー (静的ファイルの分は _headers に書いてある)
const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "frame-ancestors 'none'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};
const withSecurityHeaders = res => {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v);
  return out;
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return withSecurityHeaders(await handleApi(request, env, ctx));
    return env.ASSETS.fetch(request);
  },
};

// /api/... の処理
async function handleApi(request, env, ctx) {
  const url = new URL(request.url);
  if (url.pathname === '/api/contact') {
    return handleContact(request, {
      from: env.CONTACT_FROM, // 送り元 (kagam.io のアドレス。Email Routing を有効にしたドメインのもの)
      to: env.CONTACT_TO,     // 届け先 (シークレット。Email Routing で確認済みのアドレス)
      send: ({ from, to, raw }) => env.SEND_EMAIL.send(new EmailMessage(from, to, raw)),
      // 同じ送り元 (IP) から 60 秒に 3 通まで (wrangler.jsonc の ratelimits)
      limit: env.CONTACT_LIMITER ? async ip => (await env.CONTACT_LIMITER.limit({ key: ip || 'unknown' })).success : null,
      // Turnstile のシークレットが入っているときだけ人間確認をする
      verify: env.TURNSTILE_SECRET ? (token, ip) => verifyTurnstile(env.TURNSTILE_SECRET, token, ip) : null,
    });
  }
  if (url.pathname !== '/api/timeline') return new Response('Not found', { status: 404 });

  const cache = caches.default;
  const key = new Request(new URL('/api/timeline', url), { method: 'GET' });
  const hit = await cache.match(key);
  if (hit) return hit;

  const manualRes = await env.ASSETS.fetch(new Request(new URL('/assets/data/timeline.json', url)));
  const manual = manualRes.ok ? await manualRes.json() : [];
  const data = await buildTimeline(manual);

  const res = new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Zenn が取れなかったときは短めにキャッシュして、早めにもう一度取りに行く
      'Cache-Control': `public, max-age=300, s-maxage=${data.errors.length ? 300 : CACHE_SECONDS}`,
    },
  });
  ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}
