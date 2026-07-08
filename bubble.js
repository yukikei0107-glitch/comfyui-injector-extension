// 吹き出しエディタ
// 形（楕円/角丸/もくもく/ギザギザ）＋しっぽ4方向を「1本の輪郭（多角形）」として
// SVGで描き、テキストを重ねる。書き出しは同じ輪郭座標をcanvasに描くので一致する。

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
const VERT_ROTATE = new Set(
  ["ー", "〜", "～", "ｰ", "—", "―", "–", "‐", "－", "−", "…", "‥",
   "（", "）", "「", "」", "『", "』", "【", "】", "〔", "〕", "｛", "｝",
   "［", "］", "〈", "〉", "《", "》", "(", ")", "~", "-"]
);

// 縦書きで文字マスの「右上」に寄せる句読点（CSS vertical-rl と見た目を合わせる）
const VERT_PUNCT_TR = new Set(["、", "。", "，", "．", "､", "｡"]);
const VPUNCT_SHIFT = 0.5; // 右上への寄せ量（フォントサイズ比・調整可）

const TAIL_DEG = { br: 58, bl: 122, tr: 302, tl: 238 }; // しっぽの基準角（y下向き）
const NO_TAIL = new Set(["spike", "square"]);            // しっぽを付けない形
const hasTail = (shape) => !NO_TAIL.has(shape);

// しっぽの向き角（ラジアン）。角丸は弧ではなく直線辺に出すため、上下辺寄りの角度にする
function tailAngle(w, h, shape, tail) {
  if (shape === "round") {
    const vy = (tail === "br" || tail === "bl") ? 1 : -1;  // 下辺 or 上辺
    const hx = (tail === "br" || tail === "tr") ? 1 : -1;  // 右寄り or 左寄り
    return Math.atan2(vy * h * 0.5, hx * w * 0.28);        // 直線辺上のオフセット点へ向く角
  }
  return (TAIL_DEG[tail] != null ? TAIL_DEG[tail] : TAIL_DEG.br) * Math.PI / 180;
}

const defaults = { shape: "ellipse", tail: "br", fontKey: "kyokasho", fontPx: 20, opacity: 1, textColor: "black", outline: "none" };
const COLORS = { black: "#1a1a1a", white: "#ffffff" };
const outlineWidthFor = (fontPx) => Math.max(1.5, fontPx * 0.14); // フチの太さ（表示px）

// ===== 形ごとの輪郭（中心基準の閉じた多角形・しっぽ無し） =====
// 全周をまんべんなく（角度一様に）サンプリングする。こうすると、しっぽが
// どの方向でも輪郭上に必ず点があり、正しい位置から生える。
function shapeOutline(w, h, b, shape) {
  const cx = w / 2, cy = h / 2;
  const rx = Math.max(1, w / 2 - b / 2), ry = Math.max(1, h / 2 - b / 2);
  const N = 180; // spikes*2(=36) の倍数。ギザギザの頂点が揃う
  const pts = [];
  for (let i = 0; i < N; i++) {
    const th = i / N * 2 * Math.PI;
    const c = Math.cos(th), s = Math.sin(th);
    let x, y;
    if (shape === "round") {
      // スーパー楕円（角丸四角）。直線辺もサンプリングされる
      const n = 4.5;
      const t = 1 / Math.pow(Math.pow(Math.abs(c) / rx, n) + Math.pow(Math.abs(s) / ry, n), 1 / n);
      x = cx + t * c; y = cy + t * s;
    } else if (shape === "cloud") {
      const er = (rx * ry) / Math.sqrt((ry * c) ** 2 + (rx * s) ** 2);
      const k = 1 + 0.07 * Math.cos(11 * th); // もくもく
      x = cx + er * k * c; y = cy + er * k * s;
    } else if (shape === "spike") {
      const spikes = 18;
      const phase = ((th * spikes / Math.PI) % 2 + 2) % 2;
      const tri = phase < 1 ? phase : 2 - phase; // 三角波（ギザギザの直線）
      const er = (rx * ry) / Math.sqrt((ry * c) ** 2 + (rx * s) ** 2);
      const frac = 0.78 + 0.22 * tri;
      x = cx + er * frac * c; y = cy + er * frac * s;
    } else if (shape === "square") {
      // 真四角（鋭角）。各辺までの距離の最小
      const r = Math.min(rx / Math.abs(c), ry / Math.abs(s));
      x = cx + r * c; y = cy + r * s;
    } else { // ellipse
      x = cx + rx * c; y = cy + ry * s;
    }
    pts.push([x, y]);
  }
  return pts;
}

// 形＋しっぽの輪郭。輪郭の中で「しっぽ方向の口元」を先端(tip)に置き換える
function bubbleOutlinePoints(w, h, border, shape, tail) {
  const base = shapeOutline(w, h, border, shape);
  if (!hasTail(shape)) return base; // ギザギザ・真四角はしっぽ無し
  const cx = w / 2, cy = h / 2;
  const am = tailAngle(w, h, shape, tail);
  const spread = 8 * Math.PI / 180;
  const inMouth = (p) => {
    let d = Math.atan2(p[1] - cy, p[0] - cx) - am;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return Math.abs(d) < spread;
  };
  let sum = 0, n = 0;
  for (const p of base) if (inMouth(p)) { sum += Math.hypot(p[0] - cx, p[1] - cy); n++; }
  const rMouth = n ? sum / n : Math.min(w, h) / 2;
  const ext = Math.min(w, h) * 0.09 + border * 2; // しっぽの長さ（小さめ）
  const tip = [cx + (rMouth + ext) * Math.cos(am), cy + (rMouth + ext) * Math.sin(am)];

  const out = []; let inserted = false;
  for (const p of base) {
    if (inMouth(p)) { if (!inserted) { out.push(tip); inserted = true; } continue; }
    out.push(p);
  }
  if (!inserted) out.push(tip);
  return out;
}
const strokeJoin = (shape) => (shape === "spike" || shape === "square" ? "miter" : "round");

// ===== 画像読み込み =====
function loadImageFromSrc(src) {
  return new Promise(async (resolve) => {
    let finalSrc = src;
    if (/^https?:/i.test(src)) {
      try { const r = await fetch(src); finalSrc = URL.createObjectURL(await r.blob()); } catch (e) {}
    }
    baseImg.onload = () => { placeholder.style.display = "none"; baseImg.style.display = "block"; resolve(true); };
    baseImg.onerror = () => { alert("画像を読み込めませんでした"); resolve(false); };
    baseImg.src = finalSrc;
  });
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
const shapeSel = document.getElementById("bubble-shape");
const fontFamilySel = document.getElementById("font-family");
const fontSizeSel = document.getElementById("font-size");
const textColorSel = document.getElementById("text-color");
const textOutlineSel = document.getElementById("text-outline");
const fillOpacitySel = document.getElementById("fill-opacity");
const tailBtns = [...document.querySelectorAll(".tailbtn[data-tail]")];
SIZES.forEach(s => { const o = document.createElement("option"); o.value = s; o.textContent = s + "pt"; fontSizeSel.appendChild(o); });

let selected = null;

function applyFont(b) {
  const t = b.querySelector(".bubble-text");
  t.style.fontFamily = FONTS[b.dataset.fontKey] || FONTS.kyokasho;
  t.style.fontSize = b.dataset.fontPx + "px";
  applyTextStyle(b); // フチの太さがフォントサイズに比例するので一緒に更新
}

// 文字色・フチ取り（編集画面）
function applyTextStyle(b) {
  const t = b.querySelector(".bubble-text");
  t.style.color = COLORS[b.dataset.textColor] || COLORS.black;
  if (b.dataset.outline && b.dataset.outline !== "none") {
    t.style.webkitTextStrokeColor = COLORS[b.dataset.outline] || COLORS.white;
    t.style.webkitTextStrokeWidth = outlineWidthFor(+b.dataset.fontPx) + "px";
    t.style.paintOrder = "stroke fill"; // フチを文字の後ろに（文字を細らせない）
  } else {
    t.style.webkitTextStrokeWidth = "0";
    t.style.paintOrder = "";
  }
}

function renderShape(b) {
  const w = b.offsetWidth, h = b.offsetHeight;
  const op = parseFloat(b.dataset.opacity);
  const pts = bubbleOutlinePoints(w, h, BORDER, b.dataset.shape, b.dataset.tail);
  const svg = b.querySelector(".bubble-svg");
  svg.setAttribute("width", w);
  svg.setAttribute("height", h);
  const poly = svg.querySelector("polygon");
  poly.setAttribute("points", pts.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" "));
  poly.setAttribute("fill", `rgba(255,255,255,${op})`);
  poly.setAttribute("stroke", "#1a1a1a");
  poly.setAttribute("stroke-width", BORDER);
  poly.setAttribute("stroke-linejoin", strokeJoin(b.dataset.shape));
}

function syncToolbar() {
  if (!selected) { grpSel.classList.add("disabled"); return; }
  grpSel.classList.remove("disabled");
  shapeSel.value = selected.dataset.shape;
  fontFamilySel.value = selected.dataset.fontKey;
  fontSizeSel.value = selected.dataset.fontPx;
  textColorSel.value = selected.dataset.textColor;
  textOutlineSel.value = selected.dataset.outline;
  fillOpacitySel.value = selected.dataset.opacity;
  const tailOn = hasTail(selected.dataset.shape);
  tailBtns.forEach(btn => {
    btn.disabled = !tailOn;
    btn.classList.toggle("active", tailOn && btn.dataset.tail === selected.dataset.tail);
  });
}

function selectBubble(b) {
  if (selected) selected.classList.remove("selected");
  selected = b;
  if (b) b.classList.add("selected");
  syncToolbar();
}

shapeSel.addEventListener("change", () => { if (!selected) return; selected.dataset.shape = defaults.shape = shapeSel.value; renderShape(selected); syncToolbar(); });
tailBtns.forEach(btn => btn.addEventListener("click", () => {
  if (!selected) return;
  selected.dataset.tail = defaults.tail = btn.dataset.tail;
  renderShape(selected); syncToolbar();
}));
fontFamilySel.addEventListener("change", () => { if (!selected) return; selected.dataset.fontKey = defaults.fontKey = fontFamilySel.value; applyFont(selected); });
fontSizeSel.addEventListener("change", () => { if (!selected) return; selected.dataset.fontPx = defaults.fontPx = fontSizeSel.value; applyFont(selected); });
textColorSel.addEventListener("change", () => { if (!selected) return; selected.dataset.textColor = defaults.textColor = textColorSel.value; applyTextStyle(selected); });
textOutlineSel.addEventListener("change", () => { if (!selected) return; selected.dataset.outline = defaults.outline = textOutlineSel.value; applyTextStyle(selected); });
fillOpacitySel.addEventListener("change", () => { if (!selected) return; selected.dataset.opacity = defaults.opacity = fillOpacitySel.value; renderShape(selected); });

// 重なり順（DOMの並び＝重なり順。後の要素ほど前面）
const getBubbles = () => [...stage.querySelectorAll(".bubble")];
document.getElementById("z-front").addEventListener("click", () => { if (selected) stage.appendChild(selected); });
document.getElementById("z-back").addEventListener("click", () => {
  if (!selected) return; const bs = getBubbles();
  if (bs[0] !== selected) stage.insertBefore(selected, bs[0]);
});
document.getElementById("z-up").addEventListener("click", () => {
  if (!selected) return; const bs = getBubbles(); const i = bs.indexOf(selected);
  if (i < bs.length - 1) stage.insertBefore(bs[i + 1], selected);
});
document.getElementById("z-down").addEventListener("click", () => {
  if (!selected) return; const bs = getBubbles(); const i = bs.indexOf(selected);
  if (i > 0) stage.insertBefore(selected, bs[i - 1]);
});

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
  b.dataset.shape = opt.shape || defaults.shape;
  b.dataset.tail = opt.tail || defaults.tail;
  b.dataset.fontKey = opt.fontKey || defaults.fontKey;
  b.dataset.fontPx = opt.fontPx || defaults.fontPx;
  b.dataset.textColor = opt.textColor || defaults.textColor;
  b.dataset.outline = opt.outline || defaults.outline;
  b.dataset.opacity = opt.opacity != null ? opt.opacity : defaults.opacity;
  b.style.left = px + "px"; b.style.top = py + "px";
  b.style.width = bw + "px"; b.style.height = bh + "px";

  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("class", "bubble-svg");
  svg.appendChild(document.createElementNS(SVGNS, "polygon"));

  const text = document.createElement("div");
  text.className = "bubble-text";
  text.contentEditable = "true";
  text.textContent = opt.text != null ? opt.text : "テキスト";

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

function duplicateBubble(src) {
  const b = addBubble({
    x: parseFloat(src.style.left) + 20, y: parseFloat(src.style.top) + 20,
    w: src.offsetWidth, h: src.offsetHeight,
    shape: src.dataset.shape, tail: src.dataset.tail,
    fontKey: src.dataset.fontKey, fontPx: src.dataset.fontPx, opacity: src.dataset.opacity,
    textColor: src.dataset.textColor, outline: src.dataset.outline,
    text: src.querySelector(".bubble-text").innerText
  });
  return b;
}

function wireBubble(b) {
  const textEl = b.querySelector(".bubble-text");
  let editing = false;
  textEl.addEventListener("dblclick", () => { editing = true; textEl.focus(); });
  textEl.addEventListener("blur", () => { editing = false; });
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

// ===== キーボード操作（削除・移動・複製） =====
window.addEventListener("keydown", (e) => {
  const ae = document.activeElement;
  if (ae && ae.classList && ae.classList.contains("bubble-text")) return; // 文字編集中は無効
  if ((e.metaKey || e.ctrlKey) && (e.key === "d" || e.key === "D")) {
    if (selected) { e.preventDefault(); duplicateBubble(selected); }
    return;
  }
  if (!selected) return;
  if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    const b = selected; selectBubble(null); b.remove();
  } else if (e.key.startsWith("Arrow")) {
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    let x = parseFloat(selected.style.left), y = parseFloat(selected.style.top);
    if (e.key === "ArrowLeft") x -= step;
    if (e.key === "ArrowRight") x += step;
    if (e.key === "ArrowUp") y -= step;
    if (e.key === "ArrowDown") y += step;
    selected.style.left = clamp(x, 0, stage.clientWidth - selected.offsetWidth) + "px";
    selected.style.top = clamp(y, 0, stage.clientHeight - selected.offsetHeight) + "px";
  }
});

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

    const pts = bubbleOutlinePoints(w, h, BORDER * scale, b.dataset.shape, b.dataset.tail);
    ctx.beginPath();
    ctx.moveTo(x + pts[0][0], y + pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(x + pts[i][0], y + pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = `rgba(255,255,255,${op})`;
    ctx.fill();
    ctx.lineJoin = strokeJoin(b.dataset.shape);
    ctx.lineWidth = BORDER * scale;
    ctx.strokeStyle = "#1a1a1a";
    ctx.stroke();

    const fill = COLORS[b.dataset.textColor] || COLORS.black;
    const outline = (b.dataset.outline && b.dataset.outline !== "none") ? (COLORS[b.dataset.outline] || COLORS.white) : null;
    const outlineW = outline ? outlineWidthFor(parseFloat(cs.fontSize)) * scale : 0;
    drawVerticalText(ctx, textEl.innerText.trim(), x, y, w, h, cs.fontFamily, parseFloat(cs.fontSize) * scale, fill, outline, outlineW);
  });

  canvas.toBlob((blob) => {
    const a = document.createElement("a");
    a.download = "bubble_" + tsName() + ".png";
    a.href = URL.createObjectURL(blob); a.click(); URL.revokeObjectURL(a.href);
  }, "image/png");
}

// 縦書きテキスト（編集画面に合わせる：列間1.1em／文字送り1em／アタマ揃え／inset 12%/16%）
function drawVerticalText(ctx, text, x, y, w, h, fontFamily, fontPx, fillColor, outlineColor, outlineW) {
  if (!text) return;
  fillColor = fillColor || "#1a1a1a";
  ctx.font = `600 ${fontPx}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  const drawChar = (ch, px, py) => {
    ctx.save();
    ctx.translate(px, py);
    if (VERT_ROTATE.has(ch)) ctx.rotate(Math.PI / 2);
    else if (VERT_PUNCT_TR.has(ch)) ctx.translate(fontPx * VPUNCT_SHIFT, -fontPx * VPUNCT_SHIFT); // 読点/句点は右上へ
    if (outlineColor) { ctx.strokeStyle = outlineColor; ctx.lineWidth = outlineW * 2; ctx.strokeText(ch, 0, 0); }
    ctx.fillStyle = fillColor;
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  };
  const colSpacing = fontPx * 1.1, charH = fontPx * 1.0;
  const innerTop = y + h * 0.12 + charH; // 入力開始を1文字分下げる
  const innerH = h * 0.76 - charH;
  const maxPerCol = Math.max(1, Math.floor(innerH / charH));
  const cols = [];
  for (const para of text.split("\n")) {
    const chars = [...para];
    if (!chars.length) { cols.push([]); continue; }
    for (let i = 0; i < chars.length; i += maxPerCol) cols.push(chars.slice(i, i + maxPerCol));
  }
  if (!cols.length) return;
  const cx = x + w / 2;
  let colX = cx + (cols.length - 1) * colSpacing / 2;
  for (const col of cols) {
    let chY = innerTop + charH / 2;
    for (const ch of col) { drawChar(ch, colX, chY); chY += charH; }
    colX -= colSpacing;
  }
}

// ===== レイアウト保存/読込（画像＋吹き出しをJSONに） =====
function tsName() {
  const t = new Date(), p = n => String(n).padStart(2, "0");
  return `${t.getFullYear()}${p(t.getMonth()+1)}${p(t.getDate())}_${p(t.getHours())}${p(t.getMinutes())}${p(t.getSeconds())}`;
}
function imageDataURL() {
  const c = document.createElement("canvas");
  c.width = baseImg.naturalWidth; c.height = baseImg.naturalHeight;
  c.getContext("2d").drawImage(baseImg, 0, 0);
  return c.toDataURL("image/png");
}

document.getElementById("btn-layout-save").addEventListener("click", () => {
  if (!baseImg.src || baseImg.style.display === "none") { alert("画像がありません"); return; }
  const sw = baseImg.clientWidth, sh = baseImg.clientHeight;
  const bubbles = [...document.querySelectorAll(".bubble")].map(b => ({
    fx: parseFloat(b.style.left) / sw, fy: parseFloat(b.style.top) / sh,
    fw: b.offsetWidth / sw, fh: b.offsetHeight / sh,
    shape: b.dataset.shape, tail: b.dataset.tail,
    fontKey: b.dataset.fontKey, fontPx: +b.dataset.fontPx, opacity: +b.dataset.opacity,
    textColor: b.dataset.textColor, outline: b.dataset.outline,
    text: b.querySelector(".bubble-text").innerText
  }));
  let image;
  try { image = imageDataURL(); }
  catch (e) { alert("画像を保存できませんでした（CORS）"); return; }
  const data = { version: 1, image, bubbles };
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const a = document.createElement("a");
  a.download = "bubble_layout_" + tsName() + ".json";
  a.href = URL.createObjectURL(blob); a.click(); URL.revokeObjectURL(a.href);
});

document.getElementById("btn-layout-load").addEventListener("click", () => document.getElementById("layout-input").click());
document.getElementById("layout-input").addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const fr = new FileReader();
  fr.onload = async () => {
    let data;
    try { data = JSON.parse(fr.result); } catch (err) { alert("レイアウトの読み込みに失敗しました"); return; }
    if (!data || !data.image || !Array.isArray(data.bubbles)) { alert("レイアウトファイルではありません"); return; }
    document.querySelectorAll(".bubble").forEach(b => b.remove());
    selectBubble(null);
    const ok = await loadImageFromSrc(data.image);
    if (!ok) return;
    const sw = baseImg.clientWidth, sh = baseImg.clientHeight;
    for (const bd of data.bubbles) {
      addBubble({
        x: bd.fx * sw, y: bd.fy * sh, w: bd.fw * sw, h: bd.fh * sh,
        shape: bd.shape, tail: bd.tail, fontKey: bd.fontKey, fontPx: bd.fontPx,
        opacity: bd.opacity, textColor: bd.textColor, outline: bd.outline, text: bd.text
      });
    }
    selectBubble(null);
  };
  fr.readAsText(f);
  e.target.value = "";
});

syncToolbar();
