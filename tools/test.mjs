// テスト: node --test tools/test.mjs
// ブラウザやネットにつながらずに確かめられる部分 (Workers の処理と、計算だけの部品) を確かめる
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseZennFeed, buildTimeline } from '../src/timeline.js';
import { handleContact, buildMail } from '../src/contact.js';
import { seaPlan, SEA_POOL, SEA_SKIP_BOTTOM } from '../assets/js/sea.js';
import { textWidth, FONT_L, FONT_M } from '../assets/js/font.js';

// ---- Zenn の記事 ----
const FEED = `<?xml version="1.0"?><rss><channel><title><![CDATA[フィード]]></title>
<item><title><![CDATA[Workers で RSS を混ぜる &amp; キャッシュする]]></title><description><![CDATA[${'長い説明。'.repeat(40)}]]></description><link>https://zenn.dev/kagam_io/articles/a</link><pubDate>Fri, 13 Nov 2026 16:30:00 GMT</pubDate></item>
<item><title><![CDATA[はじめての記事]]></title><description><![CDATA[<p>短い説明</p>]]></description><link>https://zenn.dev/kagam_io/articles/b</link><pubDate>Mon, 02 Nov 2026 03:00:00 GMT</pubDate></item>
</channel></rss>`;

test('Zenn の RSS から、タイトル・説明・リンク・日本時間の日付を読む', () => {
  const [a, b] = parseZennFeed(FEED);
  assert.equal(a.title, 'Workers で RSS を混ぜる & キャッシュする');
  assert.equal(a.date, '2026-11-14'); // 11/13 16:30 (世界標準時) → 日本時間では 11/14
  assert.equal(a.type, 'zenn');
  assert.ok(a.desc.endsWith('…') && a.desc.length <= 91); // 長い説明は 90 文字で切る
  assert.equal(a.links[0].url, 'https://zenn.dev/kagam_io/articles/a');
  assert.equal(b.desc, '短い説明'); // HTML のタグは外す
});

test('手書きの項目と Zenn の記事を、新しい順に並べる', async () => {
  const manual = [
    { date: '2026-11-15', type: 'release', title: 'kagam.io' },
    { date: '2026-11-05', title: 'メモ' }, // type が無ければ「その他」
    { date: '20XX-XX', title: '書きかけ' }, // 日付の形でないものは出さない
  ];
  const { items, errors } = await buildTimeline(manual, async () => new Response(FEED));
  assert.deepEqual(errors, []);
  assert.deepEqual(items.map(i => [i.date, i.type]), [
    ['2026-11-15', 'release'], ['2026-11-14', 'zenn'], ['2026-11-05', 'note'], ['2026-11-02', 'zenn'],
  ]);
});

test('Zenn が取れなくても、手書きの項目だけで返す', async () => {
  const { items, errors } = await buildTimeline([{ date: '2026-11-15', type: 'release', title: 'kagam.io' }],
    async () => new Response('', { status: 503 }));
  assert.equal(items.length, 1);
  assert.match(errors[0], /503/);
});

// ---- お問い合わせフォーム ----
function setup({ verify = async t => t === 'ok', limitPerIp = 3 } = {}) {
  const sent = [], counts = new Map();
  const opts = {
    from: 'contact@kagam.io', to: 'me@example.com',
    send: async m => { sent.push(m); },
    limit: async ip => { const n = (counts.get(ip) || 0) + 1; counts.set(ip, n); return n <= limitPerIp; },
    verify,
  };
  const post = (body, ip = '1.2.3.4') => handleContact(new Request('https://kagam.io/api/contact', {
    method: 'POST', headers: { 'CF-Connecting-IP': ip }, body: JSON.stringify(body),
  }), opts);
  return { sent, post, opts };
}
const ok = { message: 'こんにちは', 'cf-turnstile-response': 'ok' };

test('正しい送信だけがメールになる', async () => {
  const { sent, post } = setup();
  assert.equal((await post(ok)).status, 200);
  assert.equal(sent.length, 1);
});

test('ロボットらしい送信は、受け付けたふりをして送らない', async () => {
  const { sent, post } = setup();
  assert.equal((await post({ ...ok, leave_empty: 'http://spam' })).status, 200); // わなの欄が埋まっている
  assert.equal(sent.length, 0);
});

test('開いてすぐ (貼り付けてすぐ) 送っても、人間確認を通ればメールになる', async () => {
  const { sent, post } = setup();
  assert.equal((await post(ok)).status, 200);
  assert.equal(sent.length, 1);
});

test('入力のまちがいはエラーで返す', async () => {
  const { post } = setup({ limitPerIp: 100 });
  const err = async body => { const res = await post(body); return [res.status, (await res.json()).error]; };
  assert.deepEqual(await err({ ...ok, message: '  ' }), [400, 'empty']);
  assert.deepEqual(await err({ ...ok, email: 'not-an-email' }), [400, 'email']);
});

test('長すぎる内容は断る', async () => {
  const { post } = setup();
  const res = await post({ ...ok, message: 'あ'.repeat(3001) });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'too-long');
});

test('人間確認 (Turnstile) を通らない送信は断る', async () => {
  const { sent, post } = setup();
  const res = await post({ ...ok, 'cf-turnstile-response': 'ng' });
  assert.equal(res.status, 403);
  assert.equal(sent.length, 0);
});

test('同じ送り元からは決まった数までしか送れない', async () => {
  const { post } = setup({ limitPerIp: 2 });
  assert.equal((await post(ok)).status, 200);
  assert.equal((await post(ok)).status, 200);
  assert.equal((await post(ok)).status, 429);
  assert.equal((await post(ok, '5.6.7.8')).status, 200); // 別の送り元からは送れる
});

test('届け先か人間確認の設定が無ければ送らない', async () => {
  const { sent, opts } = setup();
  const req = () => new Request('https://kagam.io/api/contact', { method: 'POST', body: JSON.stringify(ok) });
  assert.equal((await handleContact(req(), { ...opts, to: '' })).status, 500);
  assert.equal((await handleContact(req(), { ...opts, verify: null })).status, 500); // TURNSTILE_SECRET が無い
  assert.equal(sent.length, 0);
});

test('大きすぎる本文は、ヘッダーで大きさを伝えてこなくても途中で断る', async () => {
  const { sent, opts } = setup();
  const big = JSON.stringify({ ...ok, message: 'あ'.repeat(10000) }); // 3万バイトほど
  const stream = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(big)); c.close(); } });
  const res = await handleContact(new Request('https://kagam.io/api/contact', { method: 'POST', body: stream, duplex: 'half' }), opts);
  assert.equal(res.status, 413);
  assert.equal(sent.length, 0);
});

test('名前に改行を混ぜても、メールのヘッダーは増やせない', () => {
  const raw = buildMail({ from: 'contact@kagam.io', to: 'me@example.com', name: '山田\r\nBcc: evil@x.com', email: 'a@example.com', message: 'hi' });
  const head = raw.split('\r\n\r\n')[0];
  assert.doesNotMatch(head, /^Bcc:/m);
  assert.match(head, /^Reply-To: <a@example.com>$/m);
});

// ---- 計算だけの部品 ----
test('描き足す海は、毎回同じ並び・隣の行と重ならない・下ほど暗い', () => {
  const plan = seaPlan(40, 72);
  assert.deepEqual(plan, seaPlan(40, 72)); // 行番号から決まるので、毎回同じ
  plan.forEach((p, i) => {
    assert.ok(p.row >= 72 - SEA_SKIP_BOTTOM - SEA_POOL && p.row < 72 - SEA_SKIP_BOTTOM);
    if (i > 0) assert.notEqual(p.row, plan[i - 1].row);
    if (i > 0) assert.ok(p.dark >= plan[i - 1].dark);
  });
});

test('ドット文字の幅 (字間1ドット)', () => {
  assert.equal(textWidth(FONT_L, 'Kagam.io'), 4 + 4 + 4 + 4 + 5 + 1 + 1 + 4 + 7);
  assert.equal(textWidth(FONT_M, 'About'), 5 + 4 + 4 + 4 + 3 + 4);
});
