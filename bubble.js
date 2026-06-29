// 吹き出しエディタ
// 楕円＋しっぽを「1本の輪郭（多角形近似）」としてSVGで描き、テキストを重ねる。
// 書き出しは同じ輪郭座標をcanvasに描くので編集画面と一致する。

const SVGNS = "http://www.w3.org/2000/svg";
const stage = document.getElementById("stage");
const baseImg = document.getElementById("base-img");
const placeholder = document.getElementById("placeholder");

const BORDER = 1; // 枠線(px・表示)。書き出し時はスケール倍

const FONTS = {
  kyokasho: '"YuKyokasho Yoko","YuKyokasho","UD デジタル 教科書体 NK-R","UD Digi Kyokasho NK-R","TBUDKyokashoN", serif',
  gothic:   '"Hiragino Sans","Hiragino Kaku Gothic ProN", sans-serif',
  maru:     '"Hiragino Maru Gothic ProN", sans-serif',
  mincho:   '"Hiragino Mincho ProN", serif'
};
const SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64];

// 縦書きで90°回転して描く文字（長音・波ダッシュ・各種ダッシュ・括弧類）
// 編集画面の text-orientation:mixed の自動回転を、書き出しでも再現するため
const VERT_ROTATE = new Set(
  ["ー", "〜", "～", "ｰ", "—", "―", "–", "‐", "－", "−", "…", "‥",
   "（", "）", "「", "」", "『", "』", "【", "】", "〔", "〕", "｛", "｝",
   "［", "］", "〈", "〉", "《", "》", "(", ")", "~", "-"]
);

const defaults = { tail: "br", fontKey: "kyokasho", fontPx: 20, opacity: 1 };

// しっぽの向き → 基準角度（y下向き座標）。tr=右上 br=右下 bl=左下 tl=左上
const TAIL_DEG = { br: 58, bl: 122, tr: 302, tl: 238 };

// ===== 吹き出しの輪郭（楕円＋しっぽ）を多角形で返す。編集と書き出しで共用 =====
function bubbleOutlinePoints(w, h, border, tail) {
  const cx = w / 2, cy = h / 2;
  const rx = Math.max(1, w / 2 - border / 2);
  const ry = Math.max(1, h / 2 - border / 2);
  const baseDeg = TAIL_DEG[tail] != null ? TAIL_DEG[tail] : TAIL_DEG.br;
  const spread = 7.5;                                // 口元の幅（さらに小さめ）
  const a1 = (baseDeg - spread) * Math.PI / 180;
  const a2 = (baseDeg + spread) * Math.PI / 180;
  const am = baseDeg * Math.PI / 180;
  const ext = Math.min(rx, ry) * 0.18 + border * 2;  // しっぽの長さ（さらに小さめ）
  const tip = [cx + (rx + ext) * Math.cos(am), cy + (ry + ext) * Math.sin(am)];

  const pts = [];
  const N = 72;
  const start = a2, end = a1 + 2 * Math.PI; // 口元(a1〜a2)を避けて長い方を一周
  for (let i = 0; i <= N; i++) {
    const t = start + (end - start) * i / N;
    pts.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
  }
  pts.push(tip); // 最後にしっぽの先端（閉じると p1→tip→p2 になる）
  return pts;
}

// ===== 画像読み込み =====
async function loadImageFromSrc(src) {
  let finalSrc = src;
  if (/^https?:/i.test(src)) {
    try { const r = await fetch(src); finalSrc = URL.createObjectURL(await r.blob()); } catch (e) {}
  }
  baseImg.onload = () => { placeholder.style.display = "none"; baseImg.style.display = "block"; };
  baseImg.onerror = () => alert("画像を読み込めませんでした");
  baseImg.src = finalSrc;
}
function fileToSrc(file) { const fr = new FileReader(); fr.onload = () => loadImageFromSrc(fr.result); fr.readAsDataURL(file); }

chrome.storage.local.get("bubble_image", (d) => {
  if (d && d.bubble_image) { loadImageFromSrc(d.bubble_image); chrome.storage.local.remove("bubble_image"); }
});

document.getElementById("btn-open").addEventListener("click", () => document.getElementById("file-input").click());
document.getElementById("file-input").addEventListener("change", (e) => { const f = e.target.files[0]; if (f) fileToSrc(f); });
["dragover", "dragenter"].forEach(ev => stage.addEventListener(ev, (e) => e.preventDefault()));
stage.addEventListener("drop", (e) => {
  e.preventDefault();
  const f = [...(e.dataTransfer.files || [])].find(x => x.type.startsWith("image/"));
  if (f) { fileToSrc(f); return; }
  const url = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
  if (url) loadImageFromSrc(url);
});
window.addEventListener("paste", (e) => {
  for (const it of (e.clipboardData?.items || [])) if (it.type.startsWith("image/")) { fileToSrc(it.getAsFile()); break; }
});

// ===== ツールバー =====
const grpSel = document.getElementById("grp-sel");
const fontFamilySel = document.getElementById("font-family");
const fontSizeSel = document.getElementById("font-size");
const fillOpacitySel = document.getElementById("fill-opacity");
const tailBtns = [...document.querySelectorAll(".tailbtn[data-tail]")];
SIZES.forEach(s => { const o = document.createElement("option"); o.value = s; o.textContent = s + "pt"; fontSizeSel.appendChild(o); });

let selected = null;

function applyFont(b) {
  const t = b.querySelector(".bubble-text");
  t.style.fontFamily = FONTS[b.dataset.fontKey] || FONTS.kyokasho;
  t.style.fontSize = b.dataset.fontPx + "px";
}

function renderShape(b) {
  const w = b.offsetWidth, h = b.offsetHeight;
  const op = parseFloat(b.dataset.opacity);
  const pts = bubbleOutlinePoints(w, h, BORDER, b.dataset.tail);
  const svg = b.querySelector(".bubble-svg");
  svg.setAttribute("width", w);
  svg.setAttribute("height", h);
  const poly = svg.querySelector("polygon");
  poly.setAttribute("points", pts.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" "));
  poly.setAttribute("fill", `rgba(255,255,255,${op})`);
  poly.setAttribute("stroke", "#1a1a1a");
  poly.setAttribute("stroke-width", BORDER);
  poly.setAttribute("stroke-linejoin", "round");
}

function syncToolbar() {
  if (!selected) { grpSel.classList.add("disabled"); return; }
  grpSel.classList.remove("disabled");
  fontFamilySel.value = selected.dataset.fontKey;
  fontSizeSel.value = selected.dataset.fontPx;
  fillOpacitySel.value = selected.dataset.opacity;
  tailBtns.forEach(btn => btn.classList.toggle("active", btn.dataset.tail === selected.dataset.tail));
}

function selectBubble(b) {
  if (selected) selected.classList.remove("selected");
  selected = b;
  if (b) b.classList.add("selected");
  syncToolbar();
}

tailBtns.forEach(btn => btn.addEventListener("click", () => {
  if (!selected) return;
  selected.dataset.tail = defaults.tail = btn.dataset.tail;
  renderShape(selected); syncToolbar();
}));
fontFamilySel.addEventListener("change", () => { if (!selected) return; selected.dataset.fontKey = defaults.fontKey = fontFamilySel.value; applyFont(selected); });
fontSizeSel.addEventListener("change", () => { if (!selected) return; selected.dataset.fontPx = defaults.fontPx = fontSizeSel.value; applyFont(selected); });
fillOpacitySel.addEventListener("change", () => { if (!selected) return; selected.dataset.opacity = defaults.opacity = fillOpacitySel.value; renderShape(selected); });

// ===== 吹き出しの追加・操作 =====
document.getElementById("btn-add").addEventListener("click", () => {
  if (!baseImg.src || baseImg.style.display === "none") { alert("先に画像を読み込んでください"); return; }
  addBubble();
});

function addBubble(opt = {}) {
  const bw = opt.w || 110, bh = opt.h || 170;
  const px = opt.x != null ? opt.x : Math.max(0, stage.clientWidth / 2 - bw / 2);
  const py = opt.y != null ? opt.y : Math.max(0, stage.clientHeight / 2 - bh / 2);

  const b = document.createElement("div");
  b.className = "bubble";
  b.dataset.tail = defaults.tail;
  b.dataset.fontKey = defaults.fontKey;
  b.dataset.fontPx = defaults.fontPx;
  b.dataset.opacity = defaults.opacity;
  b.style.left = px + "px"; b.style.top = py + "px";
  b.style.width = bw + "px"; b.style.height = bh + "px";

  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("class", "bubble-svg");
  const poly = document.createElementNS(SVGNS, "polygon");
  svg.appendChild(poly);

  const text = document.createElement("div");
  text.className = "bubble-text";
  text.contentEditable = "true";
  text.textContent = "テキスト";

  const del = document.createElement("div");
  del.className = "del"; del.title = "削除"; del.textContent = "×";
  const resize = document.createElement("div");
  resize.className = "resize"; resize.title = "サイズ変更";

  b.append(svg, text, del, resize);
  stage.appendChild(b);
  applyFont(b);
  renderShape(b);
  wireBubble(b);
  selectBubble(b);
  return b;
}

function wireBubble(b) {
  const textEl = b.querySelector(".bubble-text");
  let editing = false;
  textEl.addEventListener("dblclick", () => { editing = true; textEl.focus(); });
  textEl.addEventListener("blur", () => { editing = false; });

  // Enterは「改行文字」を入れる（ブロック<div>を作らせない＝縦書きで列が割れない）
  // IME変換確定のEnterには介入しない
  textEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      document.execCommand("insertText", false, "\n");
    }
  });

  b.querySelector(".del").addEventListener("click", (e) => {
    e.stopPropagation();
    if (selected === b) selectBubble(null);
    b.remove();
  });

  // リサイズ（吹き出しの大きさ＝楕円のサイズ。文字サイズとは独立）
  b.querySelector(".resize").addEventListener("mousedown", (e) => {
    e.preventDefault(); e.stopPropagation(); selectBubble(b);
    const sx = e.clientX, sy = e.clientY, ow = b.offsetWidth, oh = b.offsetHeight;
    const move = (ev) => {
      b.style.width = Math.max(50, ow + ev.clientX - sx) + "px";
      b.style.height = Math.max(60, oh + ev.clientY - sy) + "px";
      renderShape(b);
    };
    const up = () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); };
    document.addEventListener("mousemove", move); document.addEventListener("mouseup", up);
  });

  // 本体ドラッグで移動（編集中・ハンドル上は除く）
  b.addEventListener("mousedown", (e) => {
    selectBubble(b);
    if (e.target.classList.contains("del") || e.target.classList.contains("resize")) return;
    if (editing && e.target === textEl) return;
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY, ox = parseFloat(b.style.left), oy = parseFloat(b.style.top);
    const move = (ev) => {
      b.style.left = clamp(ox + ev.clientX - sx, 0, stage.clientWidth - b.offsetWidth) + "px";
      b.style.top = clamp(oy + ev.clientY - sy, 0, stage.clientHeight - b.offsetHeight) + "px";
    };
    const up = () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); };
    document.addEventListener("mousemove", move); document.addEventListener("mouseup", up);
  });
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
stage.addEventListener("mousedown", (e) => { if (e.target === stage || e.target === baseImg) selectBubble(null); });

// ===== PNG 書き出し =====
document.getElementById("btn-save").addEventListener("click", exportPNG);

function exportPNG() {
  if (!baseImg.src || baseImg.style.display === "none") { alert("画像がありません"); return; }
  const scale = baseImg.naturalWidth / baseImg.clientWidth || 1;
  const canvas = document.createElement("canvas");
  canvas.width = baseImg.naturalWidth;
  canvas.height = baseImg.naturalHeight;
  const ctx = canvas.getContext("2d");
  try { ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height); }
  catch (e) { alert("画像の描画に失敗しました（別ドメイン画像はCORSで保存できない場合があります）"); return; }

  document.querySelectorAll(".bubble").forEach((b) => {
    const x = parseFloat(b.style.left) * scale;
    const y = parseFloat(b.style.top) * scale;
    const w = b.offsetWidth * scale;
    const h = b.offsetHeight * scale;
    const textEl = b.querySelector(".bubble-text");
    const cs = getComputedStyle(textEl);
    const op = parseFloat(b.dataset.opacity);

    // 形（編集と同じ輪郭をスケールして描く）
    const pts = bubbleOutlinePoints(w, h, BORDER * scale, b.dataset.tail);
    ctx.beginPath();
    ctx.moveTo(x + pts[0][0], y + pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(x + pts[i][0], y + pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = `rgba(255,255,255,${op})`;
    ctx.fill();
    ctx.lineJoin = "round";
    ctx.lineWidth = BORDER * scale;
    ctx.strokeStyle = "#1a1a1a";
    ctx.stroke();

    // テキスト（縦書き）
    drawVerticalText(ctx, textEl.innerText.trim(), x, y, w, h, cs.fontFamily, parseFloat(cs.fontSize) * scale);
  });

  canvas.toBlob((blob) => {
    const a = document.createElement("a");
    const t = new Date(); const p = n => String(n).padStart(2, "0");
    a.download = `bubble_${t.getFullYear()}${p(t.getMonth()+1)}${p(t.getDate())}_${p(t.getHours())}${p(t.getMinutes())}${p(t.getSeconds())}.png`;
    a.href = URL.createObjectURL(blob); a.click(); URL.revokeObjectURL(a.href);
  }, "image/png");
}

// 縦書きテキスト（canvasには縦書きが無いので1文字ずつ縦に並べ、列は右→左）
// 編集画面(.bubble-text)に合わせる：列間=1.1em、文字送り=1em、アタマ揃え（上から）、
// テキスト領域は楕円ボックスの inset 12%(上下)/16%(左右)。
function drawVerticalText(ctx, text, x, y, w, h, fontFamily, fontPx) {
  if (!text) return;
  ctx.fillStyle = "#1a1a1a";
  ctx.font = `600 ${fontPx}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const colSpacing = fontPx * 1.1, charH = fontPx * 1.0;
  const innerTop = y + h * 0.12;
  const innerH = h * 0.76;
  const maxPerCol = Math.max(1, Math.floor(innerH / charH));
  const cols = [];
  for (const para of text.split("\n")) {
    const chars = [...para];
    if (!chars.length) { cols.push([]); continue; } // 空行＝空列ぶん空ける
    for (let i = 0; i < chars.length; i += maxPerCol) cols.push(chars.slice(i, i + maxPerCol));
  }
  if (!cols.length) return;
  const cx = x + w / 2;
  let colX = cx + (cols.length - 1) * colSpacing / 2; // 右の列から左へ（中央寄せ）
  for (const col of cols) {
    let chY = innerTop + charH / 2; // アタマ揃え（上から）
    for (const ch of col) {
      if (VERT_ROTATE.has(ch)) {
        // 90°回転して縦向きに（〜 ー （） などを縦書き用に）
        ctx.save();
        ctx.translate(colX, chY);
        ctx.rotate(Math.PI / 2);
        ctx.fillText(ch, 0, 0);
        ctx.restore();
      } else {
        ctx.fillText(ch, colX, chY);
      }
      chY += charH;
    }
    colX -= colSpacing;
  }
}

syncToolbar();
