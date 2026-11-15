// ---- 折りたたみ ----
// スマホ (縦長) で、全部開くと枠に収まらないときだけ折りたたむ (.foldable)。
//   一度に1つだけ開き、最初は data-default-open の項目 (Profile) だけ開いている
// それ以外 (PC / 全部収まるスマホ): 常に全部開いたまま (クリックしても閉じない)
const folds = [...document.querySelectorAll('.fold')];
const win = document.querySelector('.window');
const winBody = document.querySelector('.window-body');
const portraitMQ = matchMedia('(orientation: portrait)');
const isFoldable = () => win.classList.contains('foldable');
// 開閉アニメーション: 高さを段階的に (カクカクと) 変える
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FOLD_ANIM = { duration: 240, easing: 'steps(4, end)' };
const GAP = '16px'; // 開いているときの中身の下の余白 (CSS の .fold[open] と同じ)
const contentOf = d => d.querySelector(':scope > :not(summary)');
const running = new Map();
const remember = () => folds.forEach(d => { d.dataset.wasOpen = d.open ? '1' : '0'; });

// 折りたたむかどうかを決める: 折りたたまない見た目で全部開き、枠に収まるかを測る
// (同じフレーム内で戻すので、測っている様子は画面に出ない)
const decideFoldMode = () => {
  if (running.size) return; // 開閉アニメーション中は判定しない
  const before = isFoldable();
  win.classList.remove('foldable');
  folds.forEach(d => { d.open = true; d.classList.remove('closing'); });
  const fits = winBody.scrollHeight <= winBody.clientHeight + 1;
  const foldable = portraitMQ.matches && !fits;
  win.classList.toggle('foldable', foldable);
  if (foldable && !before) folds.forEach(d => { d.open = d.hasAttribute('data-default-open'); });
  else if (foldable) folds.forEach(d => { d.open = d.dataset.wasOpen === '1'; });
  remember();
};

const animateFold = (d, opening) => {
  const el = contentOf(d);
  running.get(d)?.cancel();
  if (opening) d.open = true;
  if (reduceMotion) { if (!opening) d.open = false; remember(); return; }
  const h = el.scrollHeight + 'px';
  el.style.overflow = 'hidden';
  const frames = [{ height: '0px', marginBottom: '0px' }, { height: h, marginBottom: GAP }];
  const anim = el.animate(opening ? frames : frames.reverse(), FOLD_ANIM);
  running.set(d, anim);
  anim.onfinish = () => {
    if (!opening) d.open = false;
    el.style.overflow = '';
    running.delete(d);
    remember();
  };
  anim.oncancel = () => { el.style.overflow = ''; };
};

// 閉じる間は .closing を付けて、三角を先に ▶ に戻す
const closeFold = d => {
  d.classList.add('closing');
  animateFold(d, false);
  const done = () => d.classList.remove('closing');
  running.get(d)?.finished.then(done, done) ?? done();
};
const openFold = d => {
  d.classList.remove('closing');
  animateFold(d, true);
};

folds.forEach(d => {
  const summary = d.querySelector('summary');
  summary.addEventListener('click', e => {
    e.preventDefault(); // 開閉はここで自前で行う (PC では何もしない)
    if (!isFoldable()) return;
    const isOpen = d.open && !d.classList.contains('closing');
    if (isOpen) return closeFold(d);
    // 1つ開いたら、ほかを閉じる
    folds.forEach(o => { if (o !== d && o.open && !o.classList.contains('closing')) closeFold(o); });
    openFold(d);
  });
});

// 枠の大きさが変わったら判定し直す (最初に scene.js が位置を決めたときも含む)
let lastSize = '';
new ResizeObserver(() => {
  const size = winBody.clientWidth + 'x' + winBody.clientHeight;
  if (size !== lastSize) { lastSize = size; decideFoldMode(); }
}).observe(winBody);
portraitMQ.addEventListener('change', decideFoldMode);
document.fonts?.ready.then(decideFoldMode);
