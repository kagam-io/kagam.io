/*
  背景の場面 (空・海・オブジェ・名前・メニュー) をキャンバスに描く。
  レイヤーを「1ドット = 1マス」の解像度で重ね、CSS でくっきり拡大する。
  位置はすべて整数ドットで決めるので、動きは必ずドット単位でカクカクする。
*/
import {
  PAGE, DOT, RES, SCENES, TOP_SHARE, TEXT_MIN_TOP, NAV_TEXT_GAP, EDGE_FADE,
  SEA_FRAMES, SEA_INTERVAL, BOB, DIM_COLOR, FLICKER_SEQ, FLICKER_DELAY, FLICKER_EVERY,
  HERO_TEXT, NAV_ITEMS, NAV_STYLE,
} from './config.js';
import { drawText, textWidth } from './font.js';
import { seaPlan, drawRow, SEA_SKIP_BOTTOM, SEA_OVERLAP } from './sea.js';
import { createNavLinks, layoutNavItems, placeNavLinks } from './nav.js';

const SHOW_HERO_TEXT = PAGE === 'home'; // 大きな名前はトップだけ
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const portrait = matchMedia('(orientation: portrait)');

// 整数ドットに丸めた正弦波 (端でゆっくり、中央で速く段が進む)
const step = (t, { amp, period }) => Math.round(amp * Math.sin((t / period) * Math.PI * 2));

// トップの名前の灰色の文字が、時刻 t に白く光っているか
const flickerAt = t => {
  if (t < FLICKER_DELAY) return false;
  let r = (t - FLICKER_DELAY) % FLICKER_EVERY;
  for (const [on, ms] of FLICKER_SEQ) { if (r < ms) return on; r -= ms; }
  return false;
};

const loadImage = src => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

// 場面の設定 (ページごとの上書きを適用したもの)。画像は別に読み込む (一度読んだら使い回す)
const sceneConfig = key => ({ ...SCENES[key], ...(SCENES[key].pages?.[PAGE] ?? {}) });
const imageCache = {};
const loadImages = key => (imageCache[key] ??= Promise.all(
  ['sky', 'object', ...SEA_FRAMES].map(n => loadImage(SCENES[key].dir + n + '.png'))
).then(([sky, object, ...seas]) => ({ sky, object, seas })));

export function startScene() {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  let scene = null;          // 場面の設定 (画像が来たら sky / object / seas が加わる)
  let W = 0, H = 0;          // キャンバスの大きさ (ドット)
  let AW = 0, AH = 0;        // 絵の大きさ (ドット)
  let art = { x: 0, y: 0 };  // キャンバス内での絵の左上
  let view = { x: 0, y: 0, top: 0, bottom: 0 }; // 画面に見えている範囲
  let nameTop = 0;           // 名前の天辺の行
  let navItems = [];         // メニュー各項目の位置
  let hovered = null;        // マウスが乗っている / キーボードで選んでいるメニュー
  let heroHover = false;     // トップの大きな名前にマウスが乗っているか
  let last = '';             // 前に描いた状態 (変わったときだけ描き直す)

  const navLinks = createNavLinks(document.querySelector('.nav'), NAV_ITEMS, PAGE, id => { hovered = id; last = ''; });

  // キャンバスの拡大率 (1ドットの画面上の大きさ) とずれ (px)
  const fit = () => {
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    const S = Math.max(cw / W, ch / H);
    return { cw, ch, S, ox: (cw - W * S) / 2, oy: (ch - H * S) / 2 };
  };

  // 画面の縦横比から、キャンバスの大きさ・絵の置き場所・名前とメニューの位置を決める
  function layout() {
    if (!scene) return;
    AW = scene.size.w;
    AH = scene.size.h;
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (cw / ch < AW / AH) {
      // 縦長: 横幅は絵のまま、足りない高さを描き足す。
      // 上に描き足す量は「画面に見えている高さ」で決める (下のバーの裏へのはみ出しぶんは全部海に回す)
      W = AW;
      H = Math.max(AH, Math.ceil(AW * ch / cw));
      const extraVisible = Math.max(0, Math.ceil(AW * Math.min(ch, innerHeight) / cw) - AH);
      art = { x: 0, y: Math.round(extraVisible * TOP_SHARE) };
    } else if (scene.extendSides) {
      // 横長 (縦長の絵の場合): 高さは絵のまま、足りない幅を左右に描き足す
      W = Math.ceil(AH * cw / ch);
      H = AH;
      art = { x: Math.floor((W - AW) / 2), y: 0 };
    } else {
      // 横長: 絵のまま (上下は object-fit: cover で少し切れる)
      W = AW;
      H = AH;
      art = { x: 0, y: 0 };
    }
    canvas.width = W * RES;
    canvas.height = H * RES;

    const { S, ox, oy } = fit();
    const cropX = Math.max(0, (W - cw / S) / 2), cropY = Math.max(0, (H - ch / S) / 2); // 切れる量 (小数)
    view = {
      x: Math.ceil(cropX), y: Math.ceil(cropY),                 // 完全に見えている最初の列・行
      top: Math.floor(cropY), bottom: Math.ceil(H - cropY) - 1, // 一部でも見えている最初と最後の行
    };

    // 名前: 基本は絵に合わせる。上が切れるときは下げるが、画面の上端やメニューには重ねない
    const nav = scene.nav;
    const navBottom = nav.top === 'name' ? -Infinity : view.y + nav.top + (NAV_STYLE.capH + 2) / RES; // 下線まで
    nameTop = Math.max(art.y + scene.text.name.y, view.y + TEXT_MIN_TOP, Math.ceil(navBottom + NAV_TEXT_GAP));

    // メニュー
    const navTop = nav.top === 'name' ? nameTop : view.y + nav.top;
    const laid = layoutNavItems(NAV_ITEMS, NAV_STYLE, nav, { right: W - view.x - nav.right, left: view.x + nav.right, top: navTop, res: RES });
    navItems = laid.items;
    placeNavLinks(navLinks, navItems, NAV_STYLE, nav, laid.lineH, { scale: S / RES, ox, oy });

    // ページの中身 (パネルなど) が使えるように、メニューの下端・水平線の位置・1ドットの大きさを渡す
    const root = document.documentElement.style;
    root.setProperty('--nav-bottom', oy + (navTop * RES + NAV_STYLE.capH) * (S / RES) + 'px');
    root.setProperty('--sea-top', oy + (art.y + scene.seaTop) * S + 'px');
    root.setProperty('--dot', S + 'px');
    root.setProperty('--view-height', Math.min(ch, innerHeight) + 'px');

    // オブジェの縦位置を、ページ上の要素 (パネルなど) の縦の真ん中にそろえる
    const target = scene.alignObjectTo && document.querySelector(scene.alignObjectTo);
    if (target) {
      const r = target.getBoundingClientRect();
      scene.objectY = Math.round((r.top + r.height / 2 - oy) / S - art.y - scene.objectMid);
    }
    last = '';
  }

  function drawSea(seaImg) {
    // 本体の上の描き足し: 空の一番上の行を伸ばす
    if (art.y > 0) ctx.drawImage(scene.sky, 0, 0, scene.sky.naturalWidth, DOT, art.x, 0, AW, art.y);
    // 下の描き足し (波のコマに合わせて動く)。絵の一番下の濃い行もここで上書きする
    if (art.y + AH < H) {
      const y0 = art.y + AH - SEA_SKIP_BOTTOM - SEA_OVERLAP;
      seaPlan(H - y0, AH).forEach(({ row, shift, dark }, i) => {
        drawRow(ctx, seaImg, row, y0 + i, { dot: DOT, artX: art.x, artW: AW, shift });
        if (dark > 0) {
          ctx.globalAlpha = dark;
          ctx.fillStyle = scene.edge;
          ctx.fillRect(0, y0 + i, W, 1);
          ctx.globalAlpha = 1;
        }
      });
    }
    // 左右の描き足し: ここまでに描いた空と海を、絵の端で折り返して鏡映しにする (オブジェは映さない)
    if (art.x > 0 || art.x + AW < W) {
      const L = art.x * RES, R = (W - art.x - AW) * RES, A = AW * RES, Hp = H * RES;
      ctx.save();
      if (L > 0) { ctx.setTransform(-1, 0, 0, 1, L, 0); ctx.drawImage(canvas, L, 0, Math.min(L, A), Hp, 0, 0, Math.min(L, A), Hp); }
      if (R > 0) { ctx.setTransform(-1, 0, 0, 1, L + A + R, 0); ctx.drawImage(canvas, L + A - Math.min(R, A), 0, Math.min(R, A), Hp, 0, 0, Math.min(R, A), Hp); }
      ctx.restore();
    }
  }

  // 見えている範囲の上下の端を、背景色 (= ブラウザのバーの色) へ段階的に溶かす
  function drawEdgeFade() {
    ctx.fillStyle = scene.edge;
    EDGE_FADE.forEach((a, i) => {
      ctx.globalAlpha = a;
      ctx.fillRect(0, view.top + i, W, 1);
      ctx.fillRect(0, view.bottom - i, W, 1);
    });
    ctx.globalAlpha = 1;
  }

  function drawHeroText(flickerOn) {
    for (const [id, txt] of Object.entries(HERO_TEXT)) {
      const pos = scene.text[id];
      const y = nameTop - scene.text.name.y + pos.y;
      const allWhite = id === 'name' && (heroHover || flickerOn);
      drawText(ctx, txt.font, txt.str, view.x + pos.x, y, {
        color: txt.color, shadow: txt.shadow, dim: allWhite ? null : txt.dim, dimColor: DIM_COLOR,
      });
    }
  }

  function drawNav() {
    for (const it of navItems) {
      const on = it.id === hovered || it.id === PAGE;
      drawText(ctx, NAV_STYLE.font, it.str, it.x, it.y, {
        color: on ? NAV_STYLE.hover : NAV_STYLE.color, dim: it.id === hovered ? null : it.dim, dimColor: DIM_COLOR,
      });
      if (on) { ctx.fillStyle = NAV_STYLE.hover; ctx.fillRect(it.x, it.y + NAV_STYLE.capH + 1, it.w, 1); } // 下線
    }
  }

  function draw(t) {
    if (scene?.sky) {
      const sea = reduceMotion ? 0 : Math.floor(t / SEA_INTERVAL) % scene.seas.length;
      const bob = reduceMotion ? 0 : step(t, BOB);
      const flickerOn = SHOW_HERO_TEXT && !reduceMotion && flickerAt(t);

      const key = [sea, bob, hovered, heroHover, flickerOn].join();
      if (key !== last) {
        last = key;
        const seaImg = scene.seas[sea];
        ctx.setTransform(RES, 0, 0, RES, 0, 0); // 以降、絵のドット単位で描く
        ctx.imageSmoothingEnabled = false;       // 拡大縮小しても各ドットの色をそのまま使う
        ctx.drawImage(scene.sky, art.x, art.y, AW, AH);
        ctx.drawImage(seaImg, art.x, art.y, AW, AH);
        drawSea(seaImg);
        ctx.drawImage(scene.object, art.x + scene.objectX, art.y + (scene.objectY ?? 0) + bob, AW, AH);
        drawEdgeFade();
        if (SHOW_HERO_TEXT) drawHeroText(flickerOn);
        ctx.setTransform(1, 0, 0, 1, 0, 0); // メニューは細かい単位で描く
        drawNav();
        markReady();
      }
    }
    if (!reduceMotion || !scene?.sky) requestAnimationFrame(draw);
  }

  // トップの大きな名前の上にマウスがあるか (キャンバス上の位置をドットに直して判定)
  if (SHOW_HERO_TEXT) {
    canvas.addEventListener('pointermove', e => {
      if (!scene?.sky) return;
      const { S, ox, oy } = fit();
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX - r.left - ox) / S, y = (e.clientY - r.top - oy) / S;
      const nx = view.x + scene.text.name.x, w = textWidth(HERO_TEXT.name.font, HERO_TEXT.name.str);
      const on = x >= nx - 1 && x <= nx + w + 1 && y >= nameTop - 1 && y <= nameTop + 8;
      if (on !== heroHover) { heroHover = on; last = ''; }
    });
    canvas.addEventListener('pointerleave', () => { if (heroHover) { heroHover = false; last = ''; } });
  }

  // 背景の絵を最初に描き終えたことをページに知らせる (パネルはこれを待って開く)。
  // 画像が読めなかったときも、パネルが出ないままにならないよう READY_TIMEOUT で開く
  const READY_TIMEOUT = 3000;
  const markReady = () => document.documentElement.classList.add('scene-ready');
  setTimeout(markReady, READY_TIMEOUT);

  const relayout = () => {
    if (!scene) return;
    layout();
    if (reduceMotion) draw(0);
  };

  // 画面が縦長なら mobile、横長なら pc の絵 (向きが変わったら切り替える)
  const pick = () => (portrait.matches ? 'mobile' : 'pc');
  const apply = () => {
    const key = pick();
    scene = sceneConfig(key); // 配置は画像を待たずに決める (パネルの大きさもすぐ決まる)
    relayout();
    loadImages(key).then(images => {
      if (pick() !== key) return;
      Object.assign(scene, images);
      last = '';
      if (reduceMotion) draw(0);
    }, markReady);
  };
  apply();
  portrait.addEventListener('change', apply);
  addEventListener('resize', relayout);

  // iPhone の Safari では、resize イベントが来ないまま画面の高さ (lvh) が変わることがある。
  // キャンバスの表示サイズそのものを見張り、変わったら描き直す (ずれると絵が拡大されて上下が切れる)
  let lastSize = '';
  new ResizeObserver(() => {
    const size = canvas.clientWidth + 'x' + canvas.clientHeight;
    if (size !== lastSize) { lastSize = size; relayout(); }
  }).observe(canvas);

  requestAnimationFrame(draw);
}
