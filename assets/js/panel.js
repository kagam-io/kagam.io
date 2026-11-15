// ゲームのウィンドウ風パネルの自前スクロールバー (About / Works 共通)
// ---- 自前のスクロールバー ----
(() => {
  const body = document.querySelector('.window-body');
  const bar = document.querySelector('.scrollbar');
  const thumb = bar.querySelector('.thumb');
  const STEP = 4; // つまみは4px刻みで動かす (ドットらしく)
  const snap = v => Math.round(v / STEP) * STEP;

  const update = () => {
    const { scrollTop, scrollHeight, clientHeight } = body;
    const overflow = scrollHeight - clientHeight;
    bar.hidden = overflow <= 1;
    if (bar.hidden) return;
    const track = bar.clientHeight;
    const h = Math.max(snap(track * clientHeight / scrollHeight), STEP * 6);
    thumb.style.height = h + 'px';
    thumb.style.top = snap((track - h) * scrollTop / overflow) + 'px';
  };

  body.addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  document.querySelectorAll('details').forEach(d => d.addEventListener('toggle', update));
  const ro = new ResizeObserver(update);
  ro.observe(body);
  document.querySelectorAll('.fold').forEach(d => ro.observe(d)); // 開閉アニメーション中も追従
[...body.children].forEach(c => ro.observe(c)); // 中身の高さが変わったとき (絞り込みなど) も追従
  document.fonts?.ready.then(update);
  update();

  // つまみのドラッグでスクロール (主に PC)
  thumb.addEventListener('pointerdown', e => {
    e.preventDefault();
    thumb.setPointerCapture(e.pointerId);
    const startY = e.clientY, startTop = body.scrollTop;
    const move = ev => {
      const ratio = (body.scrollHeight - body.clientHeight) / (bar.clientHeight - thumb.offsetHeight);
      body.scrollTop = startTop + (ev.clientY - startY) * ratio;
    };
    const up = () => {
      thumb.removeEventListener('pointermove', move);
      thumb.removeEventListener('pointerup', up);
      thumb.removeEventListener('pointercancel', up);
    };
    thumb.addEventListener('pointermove', move);
    thumb.addEventListener('pointerup', up);
    thumb.addEventListener('pointercancel', up);
  });
})();
