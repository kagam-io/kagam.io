/*
  スマホでの拡大・縮小とページの移動を止める (このサイトは1画面で、スクロールしない作り)。
  iPhone の Safari は viewport の user-scalable=no を無視するので、イベントで止める
*/
export function initTouch() {
  // ピンチ (Safari 独自の gesture イベント)
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, e => e.preventDefault(), { passive: false });
  }
  // 2本指のタッチと、スクロールできる要素 ([data-scroll]) の外での指の移動
  document.addEventListener('touchmove', e => {
    if (e.touches.length > 1 || !e.target.closest('[data-scroll]')) e.preventDefault();
  }, { passive: false });

  // それでもずれたとき: iPhone の Safari では、縮小してから動かして離すと、倍率が戻ってもページが
  // ずれたまま残る (下のバーの裏へ伸ばしたぶん、ページが画面より長いため)。等倍なら一番上に戻す
  const pinScroll = () => {
    const zoomed = (window.visualViewport?.scale ?? 1) > 1.01;
    if (!zoomed && (scrollX || scrollY)) scrollTo(0, 0);
  };
  addEventListener('scroll', pinScroll, { passive: true });
  visualViewport?.addEventListener('resize', pinScroll);
  visualViewport?.addEventListener('scroll', pinScroll);
  addEventListener('touchend', () => setTimeout(pinScroll, 400), { passive: true });
}
