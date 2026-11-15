/*
  縦長の画面で、絵の下に描き足す海。繰り返しに見えないよう、描き足す行ごとに
    ・海の下の SEA_POOL 行から1行選ぶ (隣と同じ行は避ける)
    ・左右に ±SEA_SHIFT ドットずらす (反射の光が縦にそろわないように)
    ・下に行くほど edge 色へ暗くする (最大 SEA_DARKEN、0.1 刻みで段をつける)
  選び方は行番号から決まる (波のコマが変わってもちらつかない)
*/
export const SEA_POOL = 10;
export const SEA_SKIP_BOTTOM = 1; // 海の一番下の行は色が濃く、境目に見えるので使わない
export const SEA_OVERLAP = 4;     // 絵の下端よりこの行数だけ上から描き足し、つなぎ目を模様に紛れさせる
const SEA_SHIFT = 4;
const SEA_DARKEN = 0.45;

// 行番号から決まる疑似乱数 (0〜1)
const rand = (i, salt) => {
  let x = Math.imul(i + 1, 2654435761) ^ Math.imul(salt + 7, 1597334677);
  x = Math.imul(x ^ (x >>> 15), 2246822519);
  return ((x ^ (x >>> 13)) >>> 0) / 4294967296;
};

// 描き足す rows 行ぶんの「元の行・ずらし量・暗さ」。artH は絵の高さ (ドット)
export function seaPlan(rows, artH) {
  const end = artH - SEA_SKIP_BOTTOM, plan = [];
  let prev = -1;
  for (let i = 0; i < rows; i++) {
    let row = end - 1 - Math.floor(rand(i, 1) * SEA_POOL);
    if (row === prev) row = row === end - 1 ? row - 1 : row + 1;
    prev = row;
    const shift = Math.round((rand(i, 2) * 2 - 1) * SEA_SHIFT);
    const dark = Math.round(((i + 1) / rows) * SEA_DARKEN * 10) / 10;
    plan.push({ row, shift, dark });
  }
  return plan;
}

/*
  画像の1行 (row) を、キャンバスの y 行目に横幅いっぱいで描く。
  shift ドットだけ右へずらし、はみ出した分は左へ回り込ませる
*/
export function drawRow(ctx, img, row, y, { dot, artX, artW, shift = 0 }) {
  const s = ((shift % artW) + artW) % artW;
  const sy = row * dot;
  if (s === 0) return ctx.drawImage(img, 0, sy, img.naturalWidth, dot, artX, y, artW, 1);
  ctx.drawImage(img, 0, sy, (artW - s) * dot, dot, artX + s, y, artW - s, 1);
  ctx.drawImage(img, (artW - s) * dot, sy, s * dot, dot, artX, y, s, 1);
}
