// サイト全体の設定 (絵の素材・配置・メニュー・名前・i ボタンの文言など)
import { FONT_L, FONT_S, FONT_M } from './font.js';

// どのページか (<body data-page="about"> など。無ければトップ)
export const PAGE = document.body.dataset.page || 'home';

// 素材の画像の1ドットの大きさ (px)
export const DOT = 13;

// キャンバスは絵の RES 倍の細かさで持つ。絵と名前は RES×RES マスで1ドット、
// メニューは1マスで1ドット (= 絵のドットの 1/RES の大きさ) で描く
export const RES = 3;

/*
  画面が横長なら pc、縦長なら mobile の絵を使う。
    dir:         素材のフォルダ (sky / object / sea_01〜03 の PNG)
    size:        絵の大きさ (ドット)。画像を読み込む前に配置を決めるために使う (画像と合わせること)
    objectX/Y:   オブジェのずらし (+ で右 / 下へ、ドット)
    extendSides: 画面が絵より横長 (iPad の縦など) なら、上下を切らずに左右へ空と海を鏡映しで描き足す
    edge:        上下の端を溶かす色 (海の一番下の色。ページの背景色・ブラウザのバーの色と同じ)
    seaTop:      海 (水平線) が始まる行 (ドット)
    objectMid:   オブジェの縦の中心 (絵の中の行、ドット)
    text:        名前の位置 (絵の左上から、ドット)
    nav:         メニューの位置。見えている範囲の右上から right / top ドット。
                 gap は項目の間隔 (メニュー文字のドット = 絵の 1/RES)。layout は row (横) / column (縦)。
                 top: 'name' にすると名前の天辺にそろえる
    pages:       ページごとの上書き。パネルのあるページではオブジェを右へ寄せ、縦はパネルの真ん中にそろえる
*/
const PANEL_PAGE = { objectX: 32, alignObjectTo: '.window' };
export const SCENES = {
  pc: {
    dir: '/assets/img/scene/pc/',
    size: { w: 128, h: 72 },
    objectX: 3,
    edge: '#393669',
    seaTop: 60,
    objectMid: 31.5,
    text: { name: { x: 6, y: 19 }, role: { x: 6, y: 30 } },
    nav: { layout: 'row', right: 6, top: 3, gap: 12 },
    pages: { about: PANEL_PAGE, timeline: PANEL_PAGE, contact: PANEL_PAGE, notfound: PANEL_PAGE },
  },
  mobile: {
    dir: '/assets/img/scene/mobile/',
    size: { w: 72, h: 128 },
    objectX: 2,
    extendSides: true,
    edge: '#383262',
    seaTop: 101,
    objectMid: 56,
    text: { name: { x: 6, y: 16 }, role: { x: 6, y: 27 } },
    nav: { layout: 'row', right: 6, top: 5, gap: 9 },
  },
};

// 画面の縦横比に合わせた描き足し
export const TOP_SHARE = 0.5;    // 縦長の画面で描き足す行のうち、上 (空) に回す割合
export const TEXT_MIN_TOP = 2;   // 名前と画面上端の最低限の余白 (ドット)
export const NAV_TEXT_GAP = 4;   // 右上のメニューと名前の間の最低限の余白 (ドット)
// 画面の上下の端を edge 色に溶かす濃さ。端の行から内側へ1行ずつ (ドット絵らしく段をつける)
export const EDGE_FADE = [0.85, 0.6, 0.38, 0.2, 0.08];

// 波: このコマ順で、一定間隔で切り替える
export const SEA_FRAMES = ['sea_01', 'sea_02', 'sea_03'];
export const SEA_INTERVAL = 1000; // ms

// オブジェ: 上下にぷかぷか (±amp ドット、period ms で1往復)
export const BOB = { amp: 1, period: 7000 };

// サイト名。'.' と 'o' だけ灰色にして、白い文字だけで「Kagami」と読めるようにする
export const BRAND = 'Kagam.io';
export const BRAND_DIM = [5, 7]; // BRAND の中で灰色にする文字の位置
export const DIM_COLOR = '#9c97b6';

// トップの名前の灰色の文字を「チカ、チカチカ」と点滅させる。
// 開いて FLICKER_DELAY 後に1回、そのあとは灯台の明かりのように FLICKER_EVERY ごとに1回
// [白か (true) 灰か (false), 続ける時間 ms]
export const FLICKER_SEQ = [
  [true, 70], [false, 700],            // チカ
  [true, 70], [false, 70], [true, 70], // チカチカ
];
export const FLICKER_DELAY = 600;
export const FLICKER_EVERY = 6000;

// トップの大きな文字 (位置は SCENES の text)
export const HERO_TEXT = {
  name: { str: BRAND, font: FONT_L, color: '#fff3df', shadow: '#2c2552', dim: BRAND_DIM },
  role: { str: 'Engineer', font: FONT_S, color: '#f2c6cf', shadow: '#2c2552' },
};

// 右上のメニュー。トップ以外では、左上に名前を置いてトップへ戻れるようにする
const NAV = [
  { id: 'about', str: 'About', href: '/about' },
  { id: 'timeline', str: 'Timeline', href: '/timeline' },
  { id: 'contact', str: 'Contact', href: '/contact' },
];
const HOME_LINK = { id: 'home', str: BRAND, href: '/', left: true, dim: BRAND_DIM };
export const NAV_ITEMS = PAGE === 'home' ? NAV : [HOME_LINK, ...NAV];
// 選んでいるときは色を明るくして下線を引く
export const NAV_STYLE = { font: FONT_M, capH: 7, color: '#e6d9ee', hover: '#fff3df' };

// 右下の i ボタンの中身。最初は質問の一覧で、押すとその質問の画面になる
export const INFO_QUESTIONS = [
  {
    id: 'site',
    q: 'このサイトについて',
    a: 'kagam.ioは見習いエンジニアKagamiの個人サイトです。',
  },
  {
    id: 'object',
    q: 'ぷかぷか浮いている物体はなんですか？',
    a: '僕もわかりません。このサイトを作る際、AIに作らせた叩き台にあったのでそれをドット化してそのまま採用しました。',
  },
];
export const INFO_LINKS = [{ label: 'GitHub', url: 'https://github.com/kagam-io/kagam.io' }];
export const INFO_COPY = '© 2026 kagam.io';
