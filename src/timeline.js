// タイムラインの中身を組み立てる (Cloudflare Workers と、手元の開発用サーバーで共通)
//   ・手書きの項目 (assets/data/timeline.json): type は 'release' (リリース) か 'note' (できごと・メモ)
//   ・Zenn の記事: 公開されている RSS から自動で取り込む (type: 'zenn')
// 日付の新しい順に並べて返す。

export const ZENN_USER = 'kagam_io';
const ZENN_FEED = `https://zenn.dev/${ZENN_USER}/feed`;
const DESC_MAX = 90; // Zenn の記事の説明は、この文字数で切る

const decode = s => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&amp;/g, '&');

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${name}>`));
  return m ? decode(m[1].trim()) : '';
};

// RSS の日付 → 日本時間の 'YYYY-MM-DD'
const toJstDate = s => {
  const d = new Date(s);
  if (isNaN(d)) return '';
  return new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
};

export function parseZennFeed(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]) => {
    let desc = tag(item, 'description').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (desc.length > DESC_MAX) desc = desc.slice(0, DESC_MAX) + '…';
    return {
      date: toJstDate(tag(item, 'pubDate')),
      type: 'zenn',
      title: tag(item, 'title'),
      desc,
      links: [{ label: 'Zenn で読む', url: tag(item, 'link') }],
    };
  }).filter(it => it.date && it.title);
}

export async function fetchZenn(fetchImpl = fetch) {
  const res = await fetchImpl(ZENN_FEED, { headers: { 'User-Agent': 'kagam.io timeline' } });
  if (!res.ok) throw new Error(`Zenn feed: HTTP ${res.status}`);
  return parseZennFeed(await res.text());
}

const isDate = s => /^\d{4}-\d{2}(-\d{2})?$/.test(s);

// 手書きと Zenn を混ぜて、新しい順に並べる。Zenn が取れなくても手書きだけで返す
export async function buildTimeline(manual, fetchImpl = fetch) {
  const errors = [];
  let zenn = [];
  try {
    zenn = await fetchZenn(fetchImpl);
  } catch (e) {
    errors.push(String(e.message || e));
  }
  const items = [...manual.map(it => ({ type: 'note', ...it })), ...zenn]
    .filter(it => isDate(it.date))
    .sort((a, b) => b.date.localeCompare(a.date));
  return { items, errors, generatedAt: new Date().toISOString() };
}
