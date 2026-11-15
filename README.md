# kagam.io

僕の個人サイトです。

AIにイメージ画像を作らせてこれドット絵にしたらいいんじゃねと思いドットベースのサイトにしました。

https://kagam.io

## 技術スタック

- HTML / CSS / JavaScript（フレームワーク・ビルドなし、ES モジュール）
- Canvas 2D（背景の場面とドット文字の描画）
- Cloudflare Workers（静的ファイルの配信と API）
  - Timeline: 手書きの記録と Zenn の記事（RSS）を混ぜて返す
  - Contact: お問い合わせフォーム（Email Routing・Turnstile・Rate Limiting）
- フォント: DotGothic16（Google Fonts）

## 構成

```
.
├── index.html / about.html / timeline.html / contact.html / 404.html
├── assets/
│   ├── css/
│   │   ├── scene.css        背景・メニュー・i ボタン (全ページ共通)
│   │   ├── panel.css        ウィンドウ風のパネル
│   │   └── pages/           ページごとの見た目
│   ├── js/
│   │   ├── main.js          入口
│   │   ├── config.js        設定 (絵の素材・配置・メニュー・文言)
│   │   ├── scene.js         背景の場面の描画と配置
│   │   ├── sea.js           縦長の画面で下に描き足す海
│   │   ├── font.js          ドット文字
│   │   ├── nav.js           メニュー
│   │   ├── info.js          右下の i ボタン
│   │   ├── touch.js         拡大・縮小とスクロールの抑止
│   │   ├── panel.js         パネルのスクロールバー
│   │   └── pages/           ページごとの処理
│   ├── img/
│   │   ├── scene/pc/        横長の画面の素材 (空・海3コマ・オブジェ、1ドット = 13px)
│   │   ├── scene/mobile/    縦長の画面の素材
│   │   └── marks/           Timeline の印
│   ├── data/timeline.json   Timeline の手書きの記録
│   └── icons/
├── src/                     Cloudflare Workers
│   ├── worker.js            入口 (/api/timeline・/api/contact、それ以外は静的ファイル)
│   ├── timeline.js          Zenn の記事の取り込みと並べ替え
│   └── contact.js           お問い合わせの受け付けとメールの組み立て
├── tools/test.mjs           テスト (node --test tools/test.mjs)
└── wrangler.jsonc           Workers の設定
```
