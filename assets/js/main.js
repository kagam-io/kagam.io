// 全ページ共通の入口: 背景の場面・右下の i ボタン・タッチ操作の設定
import { startScene } from './scene.js';
import { initInfo } from './info.js';
import { initTouch } from './touch.js';

startScene();
initInfo();
initTouch();
