/*
  右下の i ボタン (全ページ共通)。ボタンの枠そのものが右下を起点に伸びて、サイト情報のパネルになる。
  最初は質問の一覧で、押すとその質問の画面になり、左上の見出しで一覧に戻る。
  伸び縮みはドット単位でカクカクと (なめらかな動きをコマに分け、大きさを 4px 刻みに丸める)
*/
import { INFO_QUESTIONS, INFO_LINKS, INFO_COPY } from './config.js';

export function initInfo() {
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const views = `
    <div class="info-view" data-view="menu">
      ${INFO_QUESTIONS.map(x => `<button class="info-q" type="button" data-to="${x.id}">${esc(x.q)}</button>`).join('')}
    </div>
    ${INFO_QUESTIONS.map(x => `
    <div class="info-view" data-view="${x.id}" hidden>
      <h2><button class="info-back" type="button" data-to="menu" aria-label="戻る: ${esc(x.q)}">${esc(x.q)}</button></h2>
      <p class="info-answer">${esc(x.a)}</p>
    </div>`).join('')}
    <div class="info-foot">
      <span class="info-links">${INFO_LINKS.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('')}</span>
      <span class="copy">${esc(INFO_COPY)}</span>
    </div>`;

  const box = document.createElement('div');
  box.className = 'info';
  box.innerHTML = `<div class="info-shape">
    <div class="info-body" id="info-body" role="dialog" aria-label="このサイトについて">${views}</div>
    <button class="info-button" type="button" aria-label="このサイトについて" aria-expanded="false" aria-controls="info-body">
      <svg viewBox="0 0 14 14" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">
        <rect x="6" y="3" width="2" height="2"/>
        <rect x="5" y="6" width="3" height="1"/>
        <rect x="6" y="7" width="2" height="3"/>
        <rect x="5" y="10" width="4" height="1"/>
      </svg>
    </button>
  </div>`;
  document.body.append(box);
  const shape = box.querySelector('.info-shape'); // 大きさを変えるのはこの要素
  const button = box.querySelector('.info-button');
  const body = box.querySelector('.info-body');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let anim = null, bodyTimer = 0;

  // 閉じているときの大きさ (px)。--info-size は calc なので、同じ大きさのボタンの実寸を測る
  const closedSize = () => button.getBoundingClientRect().width + 'px';
  const bodySize = () => ({ W: body.offsetWidth, H: body.offsetHeight });
  const showView = name => body.querySelectorAll('.info-view').forEach(v => { v.hidden = v.dataset.view !== name; });
  const showBodyLater = ms => {
    clearTimeout(bodyTimer);
    bodyTimer = setTimeout(() => { if (box.classList.contains('open')) box.classList.add('show-body'); }, ms);
  };

  /*
    カクカクの伸び縮み: なめらかな動きを FRAME ミリ秒ごとのコマに分け、
    大きさは SNAP px 刻みに丸める (サイトの「ドット単位でカクッと動く」に合わせる)。
    points: [{ at: 0〜1, w, h, ease }] … ease はその点に向かう区間の加速の仕方
  */
  const FRAME = 40, SNAP = 4;
  const ease = {
    out: t => 1 - (1 - t) ** 3,
    in: t => t ** 3,
    inOut: t => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  };
  const steppedAnimate = (points, duration, fill) => {
    const n = Math.max(2, Math.round(duration / FRAME));
    const frames = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      let j = 0;
      while (j < points.length - 2 && t > points[j + 1].at) j++;
      const a = points[j], b = points[j + 1];
      const k = (b.ease || ease.inOut)(Math.min(1, Math.max(0, (t - a.at) / (b.at - a.at))));
      let w = a.w + (b.w - a.w) * k, hh = a.h + (b.h - a.h) * k;
      if (i > 0 && i < n) {
        if (Math.abs(points.at(-1).w - points[0].w) >= 1) w = Math.round(w / SNAP) * SNAP;
        if (Math.abs(points.at(-1).h - points[0].h) >= 1) hh = Math.round(hh / SNAP) * SNAP;
      }
      frames.push({ width: w + 'px', height: hh + 'px', offset: t, easing: 'steps(1, end)' });
    }
    anim?.cancel();
    anim = shape.animate(frames, { duration, fill });
  };

  // にゅっ: 今の大きさから新しい大きさへ伸びて、上と左に少し行き過ぎてから戻って落ち着く
  // (右下を起点にしているので、大きくなると上と左へ伸びる)
  const morphTo = (from, { W, H }, duration) => {
    steppedAnimate([
      { at: 0, w: parseFloat(from.w), h: parseFloat(from.h) },
      { at: 0.6, w: W + 8, h: H + 8, ease: ease.out },
      { at: 1, w: W, h: H, ease: ease.inOut },
    ], duration, 'forwards');
  };
  // 画面の切り替え: 行き過ぎはなし。変わる辺だけを、新しい大きさへまっすぐ伸び縮みさせる
  const resizeTo = (from, { W, H }, duration) => {
    steppedAnimate([
      { at: 0, w: parseFloat(from.w), h: parseFloat(from.h) },
      { at: 1, w: W, h: H, ease: ease.out },
    ], duration, 'forwards');
  };

  const open = () => {
    if (box.classList.contains('open')) return;
    box.classList.add('open');
    button.setAttribute('aria-expanded', 'true');
    showView('menu'); // 開くときはいつも一覧から
    const s = closedSize(), size = bodySize();
    if (reduce) { anim?.cancel(); Object.assign(shape.style, { width: size.W + 'px', height: size.H + 'px' }); box.classList.add('show-body'); return; }
    morphTo({ w: s, h: s }, size, 300);
    showBodyLater(150);
  };

  // 一覧 ⇄ 質問の画面の切り替え: 中身をいったん隠して、枠を新しい大きさへにゅっと変える
  const go = name => {
    const from = { w: shape.offsetWidth + 'px', h: shape.offsetHeight + 'px' };
    box.classList.remove('show-body');
    showView(name);
    const size = bodySize();
    if (reduce) { anim?.cancel(); Object.assign(shape.style, { width: size.W + 'px', height: size.H + 'px' }); box.classList.add('show-body'); return; }
    resizeTo(from, size, 200);
    showBodyLater(120);
  };

  const close = () => {
    if (!box.classList.contains('open')) return;
    clearTimeout(bodyTimer);
    box.classList.remove('open', 'show-body');
    button.setAttribute('aria-expanded', 'false');
    const s = closedSize(), cur = { width: shape.offsetWidth + 'px', height: shape.offsetHeight + 'px' };
    anim?.cancel();
    shape.style.width = shape.style.height = '';
    if (reduce) return;
    // しゅっと縮んで、ボタンより小さく潰れてから、1往復だけ揺れて元の大きさに戻る (もにゅっ)
    const S = parseFloat(s);
    steppedAnimate([
      { at: 0, w: parseFloat(cur.width), h: parseFloat(cur.height) },
      { at: 0.5, w: S * 0.82, h: S * 0.72, ease: ease.in },     // 縮みきって縦に潰れる
      { at: 0.75, w: S * 1.08, h: S * 0.94, ease: ease.out },   // 1回だけ横に戻り過ぎる
      { at: 1, w: S, h: S, ease: ease.inOut },
    ], 380);
  };

  button.addEventListener('click', e => {
    e.stopPropagation();
    box.classList.contains('open') ? close() : open();
  });
  body.addEventListener('click', e => {
    const to = e.target.closest('[data-to]')?.dataset.to;
    if (to) go(to);
  });
  box.addEventListener('click', e => {
    e.stopPropagation();
    if (!box.classList.contains('open')) open(); // 閉じているときは枠のどこを押しても開く
  });
  document.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}
