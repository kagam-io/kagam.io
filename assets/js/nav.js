/*
  右上のメニュー。文字はキャンバスに描き (scene.js)、押せる範囲だけ透明なリンクを重ねる。
  ここではリンクを作り、文字の位置を計算して、リンクをその上に置く
*/
import { textWidth } from './font.js';

/*
  透明なリンクを作る。マウスを乗せたとき・キーボードで選んだときに onHover(id) を、
  外れたときに onHover(null) を呼ぶ (キャンバス側で明るくして下線を引く)
*/
export function createNavLinks(container, items, currentPage, onHover) {
  let hovered = null;
  return items.map(item => {
    const a = document.createElement('a');
    a.href = item.href;
    a.textContent = item.str;
    a.draggable = false;
    if (item.id === currentPage) a.setAttribute('aria-current', 'page');
    const on = () => { hovered = item.id; onHover(item.id); };
    const off = () => { if (hovered === item.id) { hovered = null; onHover(null); } };
    a.addEventListener('pointerenter', on);
    a.addEventListener('pointerleave', off);
    a.addEventListener('focus', on);
    a.addEventListener('blur', off);
    container.append(a);
    return a;
  });
}

/*
  各項目の位置 (メニュー文字のドット単位 = 絵のドット × res)。
    right / left: 見えている範囲の右端・左端から、絵のドットで何ドット内側か
    top:          メニューの天辺 (絵のドット)
*/
export function layoutNavItems(items, style, nav, { right, left, top, res }) {
  const capH = style.capH, lineH = capH + 2 + nav.gap; // 大文字の高さ + 下線の余白 + 行間
  const R = right * res, L = left * res, T = top * res;
  const pos = {};
  const rightItems = items.filter(it => !it.left);
  if (nav.layout === 'row') {
    let x = R;
    for (const item of [...rightItems].reverse()) {
      const w = textWidth(style.font, item.str);
      x -= w;
      pos[item.id] = { x, y: T, w };
      x -= nav.gap;
    }
  } else {
    rightItems.forEach((item, i) => {
      const w = textWidth(style.font, item.str);
      pos[item.id] = { x: R - w, y: T + i * lineH, w };
    });
  }
  for (const item of items.filter(it => it.left)) pos[item.id] = { x: L, y: T, w: textWidth(style.font, item.str) };
  return { items: items.map(item => ({ ...item, ...pos[item.id] })), lineH };
}

/*
  透明なリンクを、キャンバス上の文字の位置に重ねる。
  押せる範囲は文字の周りに少し広げる (縦並びのときは隣の項目と重ならない高さまで)
    scale: メニュー文字1ドットの画面上の大きさ (px)、ox / oy: キャンバスのずれ (px)
*/
export function placeNavLinks(links, navItems, style, nav, lineH, { scale, ox, oy }) {
  const padX = 5, padY = nav.layout === 'row' ? 7 : (lineH - style.capH) / 2;
  navItems.forEach((it, i) => Object.assign(links[i].style, {
    left: ox + (it.x - padX) * scale + 'px',
    top: oy + (it.y - padY) * scale + 'px',
    width: (it.w + padX * 2) * scale + 'px',
    height: (style.capH + padY * 2) * scale + 'px',
  }));
}
