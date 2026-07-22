// 🖼 生成・仕上げ 別画面。お取り置き画像を選び、I2Iで944×2048へ高解像度化（使用前/使用後）。
console.log("%c[仕上げ] finish.js 起動", "color:#94e2d5;font-weight:bold");

function bgFetch(url, method = "GET", body = null) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "FETCH", url, method, body: body ? JSON.stringify(body) : null },
      (res) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else if (res && res.ok) resolve(res.data);
        else reject(new Error(res ? res.error : "no response"));
      }
    );
  });
}
function toast(msg, color = "#a6e3a1") {
  const el = document.getElementById("toast");
  el.textContent = msg; el.style.background = color;
  el.style.opacity = "1"; el.style.transform = "translateX(-50%) translateY(0)";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateX(-50%) translateY(20px)"; }, 2500);
}

const SLOTS = window.COSTUME_SLOTS || [];
const ASLOTS = window.ACTION_SLOTS || [];
const KW = window.COSTUME_KEYWORDS || {};
const DEFAULT_GEN_PROMPT = "masterpiece, best quality, 1girl, solo, 20yo, adult, full body, standing, simple background";

function extractOutfitBySlot(promptText) {
  const order = ["legwear", "shoes", "outerwear", "head", "accessory", "main"];
  const buckets = { main: [], legwear: [], shoes: [], outerwear: [], head: [], accessory: [] };
  const hasJP = /[぀-ヿ㐀-鿿＀-￯]/;
  const tags = String(promptText || "").split(",").map(s => s.trim()).filter(Boolean);
  for (const tag of tags) {
    if (hasJP.test(tag)) continue;
    const t = tag.toLowerCase();
    for (const slot of order) { if ((KW[slot] || []).some(k => t.includes(k))) { buckets[slot].push(tag); break; } }
  }
  const out = {}; for (const s of Object.keys(buckets)) out[s] = buckets[s].join(", "); return out;
}

// ===== お取り置き（衣装画面と共有ストレージ）＝ここでは選ぶだけ =====
let reservedList = []; // { url, prompt, cos, act, hires }
let currentSel = null;
function loadReserved(cb) {
  chrome.storage.local.get("costume_reserved", (d) => {
    let list = (d && Array.isArray(d.costume_reserved)) ? d.costume_reserved : null;
    if (!list || !list.length) { try { const ls = JSON.parse(localStorage.getItem("costume_reserved") || "[]"); if (ls.length) list = ls; } catch (e) {} }
    reservedList = list || [];
    if (cb) cb();
  });
}
function tagsOf(sel) {
  let cos = "", act = "";
  if (sel && sel.cos) cos = SLOTS.map(s => sel.cos[s.key]).filter(Boolean).join(", ");
  else if (sel) { const o = extractOutfitBySlot(sel.prompt || ""); cos = SLOTS.map(s => o[s.key]).filter(Boolean).join(", "); }
  if (sel && sel.act) act = ASLOTS.map(s => sel.act[s.key]).filter(Boolean).join(", ");
  return { cos, act };
}
function renderCurTags() {
  const el = document.getElementById("cur-tags");
  if (!el) return;
  if (!currentSel) { el.textContent = "右の「お取り置き」から画像を選んでください"; el.style.color = "#a6e3a1"; return; }
  const { cos, act } = tagsOf(currentSel);
  el.innerHTML = "";
  const c1 = document.createElement("div"); c1.textContent = "👗 " + (cos || "（衣装なし）");
  const c2 = document.createElement("div"); c2.style.color = "#f9e2af"; c2.style.marginTop = "4px"; c2.textContent = "🏃 " + (act || "（動作なし）");
  el.append(c1, c2);
}
function renderPicker() {
  const strip = document.getElementById("reserve-picker");
  if (!strip) return;
  if (!reservedList.length) { strip.innerHTML = '<span class="pick-empty">衣装ガチャで⭐取り置きした画像がここに出ます</span>'; return; }
  strip.innerHTML = "";
  reservedList.forEach((it) => {
    const cell = document.createElement("div");
    cell.className = "pick-cell" + (currentSel && currentSel.url === it.url ? " sel" : "");
    const img = document.createElement("img"); img.loading = "lazy"; img.src = it.url;
    cell.append(img);
    if (!it.hires) { const lr = document.createElement("div"); lr.className = "lowres"; lr.textContent = "⚠低解像度"; cell.append(lr); }
    cell.addEventListener("click", () => selectReserved(it));
    strip.appendChild(cell);
  });
}
function selectReserved(it) {
  currentSel = it;
  const bImg = document.getElementById("before-img");
  const bPh = document.getElementById("before-ph");
  bImg.src = it.url; bImg.style.display = "block"; bPh.style.display = "none";
  const bb = document.getElementById("before-badge");
  if (it.hires) { bb.textContent = "🖼 高解像度"; bb.className = "big-badge hi"; }
  else { bb.textContent = "⚠ 低解像度（拡大推奨）"; bb.className = "big-badge low"; }
  bb.style.display = "block";
  // 使用後はリセット
  const aImg = document.getElementById("after-img"); aImg.style.display = "none"; aImg.removeAttribute("src");
  document.getElementById("after-ph").style.display = "flex";
  document.getElementById("after-cap").textContent = "";
  renderCurTags();
  renderPicker();
}

// ===== 画像の保存先フォルダ（control/衣装画面と共有）=====
let saveDirHandle = null;
function dlIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("control_dl_db", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("kv");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function dlIdbSet(k, v) { const db = await dlIdb(); return new Promise((res, rej) => { const tx = db.transaction("kv", "readwrite"); tx.objectStore("kv").put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
async function dlIdbGet(k) { const db = await dlIdb(); return new Promise((res, rej) => { const tx = db.transaction("kv", "readonly"); const r = tx.objectStore("kv").get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
function setSaveDirStatus(msg, color) { const el = document.getElementById("cos-savedir-status"); if (el) { el.textContent = msg; el.style.color = color || "#6c7086"; } }
async function chooseSaveDir() {
  if (!window.showDirectoryPicker) { toast("このブラウザはフォルダ指定に未対応（Chrome系で使えます）", "#f38ba8"); return; }
  try {
    const h = await window.showDirectoryPicker({ mode: "readwrite" });
    saveDirHandle = h; await dlIdbSet("saveDir", h);
    setSaveDirStatus(`保存先: ${h.name}`, "#a6e3a1");
    toast("📁 保存先を設定しました: " + h.name);
  } catch (e) { if (e.name !== "AbortError") toast("フォルダ設定に失敗: " + e.message, "#f38ba8"); }
}
async function ensureDirPermission() {
  if (!saveDirHandle) return false;
  let p = await saveDirHandle.queryPermission({ mode: "readwrite" });
  if (p !== "granted") p = await saveDirHandle.requestPermission({ mode: "readwrite" });
  return p === "granted";
}
async function downloadAfter() {
  const img = document.getElementById("after-img");
  const src = img && img.getAttribute("src");
  if (!src || img.style.display === "none") { toast("使用後の画像がありません（先に高解像度化してください）", "#f9e2af"); return; }
  const btn = document.getElementById("gen-download");
  btn.disabled = true;
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    const t = new Date(), p = n => String(n).padStart(2, "0");
    const name = `costume_hires_${t.getFullYear()}${p(t.getMonth()+1)}${p(t.getDate())}_${p(t.getHours())}${p(t.getMinutes())}${p(t.getSeconds())}.png`;
    if (saveDirHandle && await ensureDirPermission()) {
      const fh = await saveDirHandle.getFileHandle(name, { create: true });
      const w = await fh.createWritable(); await w.write(blob); await w.close();
      toast(`💾 保存しました: ${saveDirHandle.name}/${name}`);
    } else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(a.href);
      toast("💾 ダウンロードしました: " + name);
    }
  } catch (e) { toast("ダウンロード失敗: " + (e.message || e), "#f38ba8"); }
  finally { btn.disabled = false; }
}

// ===== I2I：選択中の取り置き画像を 944×2048 へ高解像度化（img2img）=====
let busy = false;
async function upscaleI2I() {
  if (!currentSel) { toast("先に右のお取り置きから画像を選んでください", "#f9e2af"); return; }
  if (busy) return;
  busy = true;
  const TARGET_W = 944, TARGET_H = 2048;
  const denoise = Math.min(0.9, Math.max(0.1, parseFloat(document.getElementById("i2i-denoise").value) || 0.5));
  const btn = document.getElementById("btn-i2i");
  const spin = document.getElementById("after-spin");
  const aImg = document.getElementById("after-img");
  const aPh = document.getElementById("after-ph");
  const aCap = document.getElementById("after-cap");
  const oldLabel = btn.textContent; btn.disabled = true; btn.textContent = "高解像度化中...";
  aImg.style.display = "none"; aImg.removeAttribute("src"); aCap.textContent = "";
  aPh.style.display = "flex"; spin.style.display = "block";
  const setStage = (m) => { aPh.textContent = m; aPh.style.display = "flex"; };
  const showErr = (m) => { spin.style.display = "none"; setStage("⚠️ " + m); toast(m, "#f38ba8"); };
  setStage("⏳ 準備中…");
  const t0 = performance.now();
  const src = currentSel.url;
  const prompt = currentSel.prompt || DEFAULT_GEN_PROMPT;
  try {
    const blob = await (await fetch(src)).blob();
    const fd = new FormData();
    fd.append("image", blob, "costume_i2i_" + Date.now() + ".png");
    fd.append("type", "input"); fd.append("overwrite", "true");
    const upRes = await fetch(`${COMFYUI_BASE}/upload/image`, { method: "POST", body: fd });
    if (!upRes.ok) { showErr("画像アップロードに失敗: HTTP " + upRes.status); return; }
    const up = await upRes.json();
    const imageRef = up.subfolder ? `${up.subfolder}/${up.name}` : up.name;

    const history = await bgFetch(`${COMFYUI_BASE}/history`);
    const keys = Object.keys(history);
    let baseKey = null;
    for (let i = keys.length - 1; i >= 0; i--) {
      const entry = history[keys[i]];
      if (!entry || !entry.prompt || !entry.prompt[2]) continue;
      let isPreview = false;
      for (const out of Object.values(entry.outputs || {})) for (const im of (out.images || [])) if ((im.subfolder || "").startsWith("costume_preview")) isPreview = true;
      if (!isPreview) { baseKey = keys[i]; break; }
    }
    if (!baseKey) { showErr("土台にする通常生成が見つかりません。本体で普通に1枚生成してから試してください"); return; }
    const workflow = JSON.parse(JSON.stringify(history[baseKey].prompt[2]));

    let decode = null;
    for (const node of Object.values(workflow)) if ((node.class_type || "").toLowerCase().includes("vaedecode")) { decode = node; break; }
    if (!decode || !decode.inputs || !Array.isArray(decode.inputs.samples) || !Array.isArray(decode.inputs.vae)) { showErr("VAEDecodeが見つからず、I2I配線ができません（対応外のワークフロー）"); return; }
    const vaeLink = decode.inputs.vae;
    const isSampler = (n) => n && ["ksampler", "ksampleradvanced"].includes((n.class_type || "").toLowerCase());
    let samplerId = decode.inputs.samples[0];
    let sampler = workflow[samplerId];
    if (!isSampler(sampler)) { for (const [id, node] of Object.entries(workflow)) if (isSampler(node)) { samplerId = id; sampler = node; } }
    if (!isSampler(sampler) || !sampler.inputs) { showErr("KSamplerが見つからず、I2I配線ができません"); return; }

    const idLoad = "cos_i2i_load", idScale = "cos_i2i_scale", idEnc = "cos_i2i_enc";
    workflow[idLoad] = { class_type: "LoadImage", inputs: { image: imageRef, upload: "image" }, _meta: { title: "costume i2i load" } };
    workflow[idScale] = { class_type: "ImageScale", inputs: { image: [idLoad, 0], upscale_method: "lanczos", width: TARGET_W, height: TARGET_H, crop: "disabled" }, _meta: { title: "costume i2i scale" } };
    workflow[idEnc] = { class_type: "VAEEncode", inputs: { pixels: [idScale, 0], vae: vaeLink }, _meta: { title: "costume i2i encode" } };

    sampler.inputs.latent_image = [idEnc, 0];
    if ((sampler.class_type || "").toLowerCase() === "ksampler") {
      if ("denoise" in sampler.inputs) sampler.inputs.denoise = denoise;
      if ("seed" in sampler.inputs) sampler.inputs.seed = Math.floor(Math.random() * 2 ** 32);
    } else {
      const steps = typeof sampler.inputs.steps === "number" ? sampler.inputs.steps : 20;
      sampler.inputs.add_noise = "enable";
      sampler.inputs.start_at_step = Math.max(0, Math.round(steps * (1 - denoise)));
      if (typeof sampler.inputs.end_at_step === "number") sampler.inputs.end_at_step = Math.min(Math.max(sampler.inputs.end_at_step, sampler.inputs.start_at_step + 1), steps + 1);
      if ("noise_seed" in sampler.inputs) sampler.inputs.noise_seed = Math.floor(Math.random() * 2 ** 32);
    }

    const isText = (t) => t === "cliptextencode" || t === "primitivestringmultiline";
    const setText = (node) => { if (!node.inputs) return; if ("value" in node.inputs) node.inputs.value = prompt; else node.inputs.text = prompt; };
    let replaced = false;
    for (const node of Object.values(workflow)) {
      const title = (node._meta && node._meta.title || "").toLowerCase();
      if (isText((node.class_type || "").toLowerCase()) && ["positive", "ポジティブ"].some(k => title.includes(k))) { setText(node); replaced = true; break; }
    }
    if (!replaced) for (const node of Object.values(workflow)) {
      const title = (node._meta && node._meta.title || "").toLowerCase();
      if (isText((node.class_type || "").toLowerCase()) && !["negative", "ネガティブ", "neg"].some(k => title.includes(k))) { setText(node); break; }
    }

    for (const node of Object.values(workflow)) if (node.class_type === "SaveImage" && node.inputs) node.inputs.filename_prefix = "costume_preview/upscaled/up";

    const q = await bgFetch(`${COMFYUI_BASE}/prompt`, "POST", { prompt: workflow, client_id: "costume_ext" });
    if (q && q.node_errors && Object.keys(q.node_errors).length) { showErr("ワークフローのエラー: " + JSON.stringify(q.node_errors).slice(0, 200)); return; }
    const pid = q && q.prompt_id;
    if (!pid) { showErr("キュー送信に失敗（prompt_idが返らない）"); return; }
    const deadline = performance.now() + 420000;
    let url = null, execErr = null;
    while (performance.now() < deadline && !url && !execErr) {
      await new Promise(r => setTimeout(r, 500));
      setStage(`⏳ 高解像度化中… ${((performance.now() - t0) / 1000).toFixed(0)}s ／ denoise ${denoise}`);
      const data = await bgFetch(`${COMFYUI_BASE}/history/${pid}`);
      const entry = data && data[pid];
      if (!entry) continue;
      if (entry.status && entry.status.status_str === "error") { execErr = "ComfyUI側で生成エラー（ワークフローを確認）"; break; }
      for (const out of Object.values(entry.outputs || {})) { for (const im of (out.images || [])) { url = `${COMFYUI_BASE}/api/view?filename=${encodeURIComponent(im.filename)}&subfolder=${encodeURIComponent(im.subfolder || "")}&type=${im.type || "output"}`; break; } if (url) break; }
    }
    if (execErr) { showErr(execErr); return; }
    if (!url) { showErr("タイムアウト（画像が見つからない）"); return; }
    setStage("⏳ 画像を読み込み中…");
    aImg.onload = () => {
      spin.style.display = "none"; aPh.style.display = "none";
      aImg.style.display = "block";
      aCap.textContent = `${TARGET_W}x${TARGET_H} / denoise ${denoise} / ${((performance.now() - t0) / 1000).toFixed(1)}s`;
    };
    aImg.onerror = () => showErr("画像の読み込みに失敗: " + url);
    aImg.src = url;
  } catch (e) {
    showErr("I2Iに失敗: " + (e.message || e));
  } finally {
    btn.disabled = false; btn.textContent = oldLabel;
    busy = false;
  }
}

// ===== イベント =====
document.getElementById("btn-i2i").addEventListener("click", upscaleI2I);
document.getElementById("gen-download").addEventListener("click", downloadAfter);
document.getElementById("cos-set-savedir").addEventListener("click", chooseSaveDir);
(() => { const d = document.getElementById("i2i-denoise"); const v = document.getElementById("i2i-denoise-val");
  if (d && v) d.addEventListener("input", () => { v.textContent = parseFloat(d.value).toFixed(2); }); })();
document.getElementById("open-costume").addEventListener("click", () => { chrome.runtime.sendMessage({ type: "OPEN_PAGE", page: "costume.html" }); });
document.getElementById("refresh-tags").addEventListener("click", () => { loadReserved(() => { renderPicker(); toast("🔄 お取り置きを再読込しました"); }); });

// 衣装画面での取り置き変更をリアルタイム反映
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.costume_reserved) loadReserved(renderPicker);
});

// ===== 起動 =====
(function init() {
  loadReserved(() => { renderPicker(); renderCurTags(); });
  (async () => {
    try {
      const h = await dlIdbGet("saveDir");
      if (h) {
        saveDirHandle = h;
        const p = await h.queryPermission({ mode: "readwrite" });
        setSaveDirStatus(p === "granted" ? `保存先: ${h.name}` : `保存先: ${h.name}（保存時に許可を確認）`, p === "granted" ? "#a6e3a1" : "#f9e2af");
      }
    } catch (e) {}
  })();
})();
