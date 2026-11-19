/*
  タイムライン。中身は /api/timeline から読む (Cloudflare Workers が、
  手書きの assets/data/timeline.json と Zenn の記事を混ぜて新しい順に返す)。
  API が使えないとき (ふつうの静的サーバーなど) は assets/data/timeline.json だけを表示する。
*/
const KIND = { release: 'リリース', zenn: 'Zenn', note: 'その他' };
const list = document.getElementById('entries');
const status = document.getElementById('timeline-status');

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

const render = items => {
  list.replaceChildren();
  for (const w of items) {
    const type = KIND[w.type] ? w.type : 'note';
    const li = el('li', 'entry type-' + type);
    li.dataset.type = type;
    const head = el('p', 'entry-date');
    const time = el('time', null, w.date.replaceAll('-', '.'));
    time.dateTime = w.date;
    head.append(time, el('span', 'entry-kind', KIND[type]));
    li.append(head, el('h2', 'entry-title', w.title));
    if (w.desc) li.append(el('p', 'entry-desc', w.desc));
    if (w.tags?.length) {
      const ul = el('ul', 'tags');
      w.tags.forEach(t => ul.append(el('li', null, t)));
      li.append(ul);
    }
    if (w.links?.length) {
      const p = el('p', 'entry-links');
      for (const { label, url } of w.links) {
        const a = el('a', 'ext', label);
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener';
        p.append(a);
      }
      li.append(p);
    }
    list.append(li);
  }
  list.removeAttribute('aria-busy');
  hasItems = items.length > 0;
  applyFilter();
};

// ---- 絞り込み ----
const TYPES = Object.keys(KIND);
const selected = new Set(); // 空 = 全部表示
let hasItems = false;
const buttons = [...document.querySelectorAll('.filter')];

function applyFilter() {
  const all = selected.size === 0;
  buttons.forEach(b => {
    const on = all || selected.has(b.dataset.type);
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
  let last = null, shown = 0;
  for (const li of list.children) {
    const show = all || selected.has(li.dataset.type);
    li.hidden = !show;
    li.classList.remove('last-visible');
    if (show) { shown++; last = li; }
  }
  last?.classList.add('last-visible'); // 一番下の項目の下には点線を描かない
  status.textContent = !hasItems ? 'まだ何もありません' : shown ? '' : 'この種類はまだありません';
}

buttons.forEach(b => b.addEventListener('click', () => {
  const t = b.dataset.type;
  if (selected.size === 0) selected.add(t);   // 全部光っている → その色だけに
  else if (selected.has(t)) selected.delete(t); // 光っているものをもう一度 → 外す
  else selected.add(t);                         // 灰色のもの → 追加 (複数選択)
  if (selected.size === TYPES.length) selected.clear(); // 全部選んだら最初の状態に
  applyFilter();
}));

(async () => {
  try {
    const res = await fetch('/api/timeline');
    if (!res.ok) throw new Error(res.status);
    render((await res.json()).items);
  } catch {
    // API が無い環境: 手書きの項目だけ並べる
    try {
      const manual = await (await fetch('/assets/data/timeline.json')).json();
      render(manual.map(it => ({ type: 'note', ...it })).sort((a, b) => b.date.localeCompare(a.date)));
    } catch {
      status.textContent = '読み込めませんでした';
    }
  }
})();
