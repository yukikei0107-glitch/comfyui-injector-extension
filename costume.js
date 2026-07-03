// 👗 衣装ガチャ 別画面。テーマ別ガチャ＋参考ギャラリー（過去画像クリックで衣装を再利用）。
console.log("%c[衣装] costume.js 起動", "color:#cba6f7;font-weight:bold");

// ===== background 経由の fetch（control.js と同じ）=====
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

// LLM設定（辞書画面で設定した値を読むだけ）
const LLM_DEFAULTS = {
  ollama:   { url: "http://127.0.0.1:11434", model: "mistral:latest" },
  lmstudio: { url: "http://127.0.0.1:1234",  model: "magnum-v4-12b-mlx" }
};
let llmBackend = "lmstudio", llmServerUrl = LLM_DEFAULTS.lmstudio.url, llmModel = LLM_DEFAULTS.lmstudio.model;
chrome.storage.local.get(["llm_backend", "llm_server_url", "llm_model"], (d) => {
  llmBackend = d.llm_backend || "lmstudio";
  llmServerUrl = d.llm_server_url || LLM_DEFAULTS[llmBackend].url;
  llmModel = d.llm_model || LLM_DEFAULTS[llmBackend].model;
});

function toast(msg, color = "#a6e3a1") {
  const el = document.getElementById("toast");
  el.textContent = msg; el.style.background = color;
  el.style.opacity = "1"; el.style.transform = "translateX(-50%) translateY(0)";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateX(-50%) translateY(20px)"; }, 2500);
}

// ===== データ =====
const SLOTS = window.COSTUME_SLOTS || [];
const KW = window.COSTUME_KEYWORDS || {};
// テーマは同梱ぶんのコピー＋動的な「履歴から」を後で足す
const THEMES = Object.assign({}, window.COSTUME_THEMES || {});

// プレビュー生成の固定プロンプト（衣装タグの前に付く部分）。ボックスで編集・保存できる。
const DEFAULT_GEN_PROMPT = "masterpiece, best quality, 1girl, solo, 20yo, adult, full body, standing, simple background";

const rand = arr => arr[Math.floor(Math.random() * arr.length)];

// 過去プロンプトから服の部分だけをスロット別に抽出する
function extractOutfitBySlot(promptText) {
  const order = ["legwear", "shoes", "outerwear", "head", "accessory", "main"];
  const buckets = { main: [], legwear: [], shoes: [], outerwear: [], head: [], accessory: [] };
  const tags = String(promptText || "").split(",").map(s => s.trim()).filter(Boolean);
  for (const tag of tags) {
    const t = tag.toLowerCase();
    for (const slot of order) {
      if ((KW[slot] || []).some(k => t.includes(k))) { buckets[slot].push(tag); break; }
    }
  }
  const out = {};
  for (const s of Object.keys(buckets)) out[s] = buckets[s].join(", ");
  return out;
}

// ===== ガチャ状態 =====
const state = { theme: "omakase", slots: {} };
for (const s of SLOTS) state.slots[s.key] = { value: "", locked: false };

function resolveTheme() {
  const t = THEMES[state.theme];
  if (t && t.random) {
    const concrete = Object.keys(THEMES).filter(k => !THEMES[k].random && THEMES[k].slots);
    return THEMES[rand(concrete)];
  }
  return t;
}
function rollOne(themeObj, key) {
  const pool = themeObj && themeObj.slots && themeObj.slots[key];
  return pool && pool.length ? rand(pool) : "";
}
function rollAll() {
  const themeObj = resolveTheme();
  for (const s of SLOTS) {
    if (state.slots[s.key].locked) continue;
    state.slots[s.key].value = rollOne(themeObj, s.key);
  }
  render();
}
function rollSlot(key) {
  state.slots[key].value = rollOne(resolveTheme(), key);
  render();
}
function buildString() {
  return SLOTS.map(s => (state.slots[s.key].value || "").trim()).filter(Boolean).join(", ");
}

// タグの見た目を調べる画像検索を開く（danbooruタグ想定→Google画像検索）
function openTagSearch(tag) {
  if (!tag) return;
  const q = encodeURIComponent(tag + " anime");
  window.open("https://www.google.com/search?tbm=isch&q=" + q, "_blank");
}

// ===== 描画 =====
function renderThemes() {
  const row = document.getElementById("theme-row");
  row.innerHTML = "";
  for (const key of Object.keys(THEMES)) {
    const b = document.createElement("button");
    b.className = "theme-btn" + (key === state.theme ? " active" : "");
    b.textContent = THEMES[key].label;
    b.addEventListener("click", () => {
      state.theme = key;
      for (const s of SLOTS) state.slots[s.key].locked = false; // テーマ変更で固定解除
      renderThemes();
      rollAll();
    });
    row.appendChild(b);
  }
}

function render() {
  const el = document.getElementById("slots");
  el.innerHTML = "";
  for (const s of SLOTS) {
    const st = state.slots[s.key];
    const row = document.createElement("div");
    row.className = "slot";

    const label = document.createElement("span");
    label.className = "s-label"; label.textContent = s.label;

    const val = document.createElement("span");
    val.className = "s-val" + (st.value ? "" : " empty");
    val.textContent = st.value || "—";

    const searchBtn = document.createElement("button");
    searchBtn.className = "s-btn s-roll"; searchBtn.textContent = "🔍"; searchBtn.title = "画像検索でどんな物か確認";
    searchBtn.addEventListener("click", () => openTagSearch(st.value));

    const rollBtn = document.createElement("button");
    rollBtn.className = "s-btn s-roll"; rollBtn.textContent = "🎲"; rollBtn.title = "このパーツだけ振り直す";
    rollBtn.addEventListener("click", () => rollSlot(s.key));

    const lockBtn = document.createElement("button");
    lockBtn.className = "s-btn s-lock" + (st.locked ? " on" : "");
    lockBtn.textContent = st.locked ? "🔒" : "🔓";
    lockBtn.title = st.locked ? "固定中（クリックで解除）" : "固定して再ガチャで維持";
    lockBtn.addEventListener("click", () => { st.locked = !st.locked; render(); });

    row.append(label, val, searchBtn, rollBtn, lockBtn);
    el.appendChild(row);
  }
  document.getElementById("preview").textContent = buildString() || "（空）";
  try { chrome.storage.local.set({ costume_state_full: state }); } catch (e) {}
}

// ===== AI提案 =====
function aiPropose() {
  const themeObj = THEMES[state.theme];
  const themeLabel = themeObj ? themeObj.label.replace(/^[🎲⭐]\s*/, "") : "any";
  const vibe = (document.getElementById("costume-vibe").value || "").trim();
  const btn = document.getElementById("btn-ai");
  btn.disabled = true; btn.textContent = "考え中...";
  chrome.runtime.sendMessage({
    type: "ollama-generate",
    backend: llmBackend, serverUrl: llmServerUrl, model: llmModel,
    temperature: 0.9, maxTokens: 512,
    system: "You are an outfit stylist for anime image-generation prompts. Propose ONE coherent, creative outfit for a single girl. Theme: " + themeLabel + ". Vibe: " + (vibe || "any") + ".\nOutput EXACTLY these labeled lines and nothing else. Each value is lowercase Danbooru-style comma-separated tags, or 'none' if not applicable:\nmain: <top and bottom, or a dress>\nlegwear: <socks/tights or none>\nshoes: <footwear>\nouterwear: <jacket/coat or none>\nhead: <headwear/hair accessory or none>\naccessory: <accessory or none>\nNo explanations, no extra lines.",
    prompt: "Theme: " + themeLabel + (vibe ? (" / Vibe: " + vibe) : "")
  }, (response) => {
    btn.disabled = false; btn.textContent = "🤖 AIで考える";
    if (!response || !response.success || !response.response) {
      toast("AI提案に失敗（AIサーバー未起動？）", "#f38ba8"); return;
    }
    let raw = response.response.replace(/<think>[\s\S]*?<\/think>/gi, "");
    if (/<\/think>/i.test(raw)) raw = raw.split(/<\/think>/i).pop();
    for (const s of SLOTS) {
      if (state.slots[s.key].locked) continue;
      const m = raw.match(new RegExp("^\\s*" + s.key + "\\s*[:：]\\s*(.+)$", "im"));
      if (m) {
        let v = m[1].trim().replace(/^["'`]+|["'`]+$/g, "").trim();
        if (/^(none|なし|n\/a|-)$/i.test(v)) v = "";
        state.slots[s.key].value = v;
      }
    }
    render();
    toast("🤖 AIが衣装を提案しました");
  });
}

// ===== 参考（5枚並べ、◀▶で5枚ずつ送る）=====
const REF_PAGE = 5;
let galleryItems = []; // { url, prompt }（通常生成のみ。プレビューは除外）
let refList = [];      // フィルタ適用後の表示対象
let refPage = 0;
let previewList = [];  // { url, prompt } 「この衣装で生成」した過去プレビュー（新しい順）
let genIndex = 0;      // 右上プレビュー枠で今見ているプレビューの位置

// 過去プレビューの i 番目（0=最新）を右上の枠に表示
function showPreviewAt(i) {
  const img = document.getElementById("gen-img");
  const ph = document.getElementById("gen-placeholder");
  const badge = document.getElementById("gen-badge");
  const cap = document.getElementById("gen-caption");
  const counter = document.getElementById("gen-counter");
  if (!previewList.length) { counter.textContent = "– / –"; renderGen3(); return; }
  genIndex = Math.max(0, Math.min(i, previewList.length - 1));
  const it = previewList[genIndex];
  img.onload = null; img.onerror = null; // 生成時のハンドラを無効化
  ph.style.display = "none";
  img.src = it.url; img.style.display = "block";
  badge.style.display = "block";
  const outfit = extractOutfitBySlot(it.prompt || "");
  cap.textContent = SLOTS.map(s => outfit[s.key]).filter(Boolean).join(", ") || "";
  counter.textContent = `${genIndex + 1} / ${previewList.length}`;
  renderGen3();
}

// 生成プレビューを3枚並べる（今見ているものを含むページ）。クリックで大プレビューに表示。
function renderGen3() {
  const row = document.getElementById("gen3-row");
  if (!row) return;
  if (!previewList.length) { row.innerHTML = '<div class="ref-empty" style="position:static;">まだプレビューがありません</div>'; return; }
  const page = Math.floor(genIndex / 3);
  const items = previewList.slice(page * 3, page * 3 + 3);
  row.innerHTML = "";
  items.forEach((it, k) => {
    const absIdx = page * 3 + k;
    const cell = document.createElement("div");
    cell.className = "gen3-cell" + (absIdx === genIndex ? " sel" : "");
    const img = document.createElement("img");
    img.loading = "lazy"; img.src = it.url;
    cell.appendChild(img);
    cell.addEventListener("click", () => showPreviewAt(absIdx));
    row.appendChild(cell);
  });
}

// ===== ⭐ お取り置き（気に入ったプレビューを小さい帯に常設保存）=====
let reservedList = []; // { url, prompt }
function saveReserved() {
  try { chrome.storage.local.set({ costume_reserved: reservedList }); } catch (e) {}
}
function renderReserve() {
  const strip = document.getElementById("reserve-strip");
  if (!reservedList.length) { strip.innerHTML = '<span class="reserve-empty">⭐で気に入ったプレビューをここに取り置き</span>'; return; }
  strip.innerHTML = "";
  reservedList.forEach((it, idx) => {
    const cell = document.createElement("div");
    cell.className = "reserve-cell";
    const outfit = extractOutfitBySlot(it.prompt || "");
    cell.title = "クリックで衣装を読込\n\n" + (SLOTS.map(s => outfit[s.key]).filter(Boolean).join(", ") || "");
    const img = document.createElement("img");
    img.loading = "lazy"; img.src = it.url;
    const rm = document.createElement("div");
    rm.className = "rm"; rm.textContent = "×"; rm.title = "取り置きから外す";
    rm.addEventListener("click", (e) => { e.stopPropagation(); reservedList.splice(idx, 1); saveReserved(); renderReserve(); });
    cell.append(img, rm);
    cell.addEventListener("click", () => applyOutfitFromPrompt(it.prompt));
    strip.appendChild(cell);
  });
}
function reserveCurrent() {
  const it = previewList[genIndex];
  if (!it) { toast("取り置きするプレビューがありません", "#f9e2af"); return; }
  if (reservedList.some(r => r.url === it.url)) { toast("すでに取り置き済みです", "#f9e2af"); return; }
  reservedList.unshift({ url: it.url, prompt: it.prompt });
  saveReserved();
  renderReserve();
  toast("⭐ 取り置きしました");
}

async function loadGallery() {
  const row = document.getElementById("ref-row");
  row.innerHTML = '<div class="ref-empty">読み込み中…</div>';
  try {
    const history = await bgFetch(`${COMFYUI_BASE}/history`);
    const items = [], previews = [];
    for (const pid of Object.keys(history)) {
      const entry = history[pid];
      const pobj = entry.prompt && entry.prompt[2];
      const ptext = pobj ? extractPositive(pobj) : "";
      for (const nodeOut of Object.values(entry.outputs || {})) {
        for (const img of (nodeOut.images || [])) {
          if ((img.type || "output") !== "output") continue;
          const url = `${COMFYUI_BASE}/api/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || "")}&type=output`;
          if ((img.subfolder || "").startsWith("costume_preview")) { previews.push({ url, prompt: ptext }); continue; } // 過去プレビューは別枠へ
          items.push({ url, prompt: ptext });
        }
      }
    }
    items.reverse(); previews.reverse(); // 新しい順
    galleryItems = items;
    previewList = previews;
    buildHistoryTheme();
    applyRefFilter();
    showPreviewAt(0); // 過去プレビューがあれば最新を右上に表示（無ければカウンタのみ）
  } catch (e) {
    row.innerHTML = '<div class="ref-empty">履歴を取得できませんでした（ComfyUI未接続？）</div>';
  }
}

// フィルタを適用して表示対象を作り直す（先頭＝最新から表示）
function applyRefFilter() {
  const f = (document.getElementById("gallery-filter").value || "").trim().toLowerCase();
  refList = f ? galleryItems.filter(it => it.prompt.toLowerCase().includes(f)) : galleryItems.slice();
  refPage = 0;
  renderRefPage();
}

// 現在ページの5枚を並べて表示（各クリックで衣装を読込）
function renderRefPage() {
  const row = document.getElementById("ref-row");
  const counter = document.getElementById("ref-counter");
  const pages = Math.ceil(refList.length / REF_PAGE);
  if (!refList.length) {
    row.innerHTML = '<div class="ref-empty">参考画像がありません</div>';
    counter.textContent = "– / –";
    return;
  }
  refPage = Math.max(0, Math.min(refPage, pages - 1));
  const items = refList.slice(refPage * REF_PAGE, refPage * REF_PAGE + REF_PAGE);
  row.innerHTML = "";
  for (const it of items) {
    const outfit = extractOutfitBySlot(it.prompt);
    const summary = SLOTS.map(s => outfit[s.key]).filter(Boolean).join(", ") || "(検出なし)";
    const cell = document.createElement("div");
    cell.className = "ref-cell";
    cell.title = "クリックでこの衣装を読込\n\n" + summary;
    const img = document.createElement("img");
    img.loading = "lazy"; img.src = it.url;
    const cap = document.createElement("div");
    cap.className = "rc-cap"; cap.textContent = summary;
    cell.append(img, cap);
    cell.addEventListener("click", () => applyOutfitFromPrompt(it.prompt));
    row.appendChild(cell);
  }
  counter.textContent = `${refPage + 1} / ${pages}`;
}

// 過去画像の衣装をスロットに読み込む（ロック中のスロットは維持）
function applyOutfitFromPrompt(promptText) {
  const outfit = extractOutfitBySlot(promptText);
  let any = false;
  for (const s of SLOTS) {
    if (state.slots[s.key].locked) continue;
    state.slots[s.key].value = outfit[s.key] || "";
    if (outfit[s.key]) any = true;
  }
  render();
  toast(any ? "🖼 この画像の衣装を読み込みました" : "衣装タグを検出できませんでした", any ? "#a6e3a1" : "#f9e2af");
}

// 履歴から個人用テーマを組み立てる（各スロット＝過去に使った衣装タグの集合）
function buildHistoryTheme() {
  const pools = {}; for (const s of SLOTS) pools[s.key] = [];
  const seen = {}; for (const s of SLOTS) seen[s.key] = new Set();
  for (const it of galleryItems) {
    const outfit = extractOutfitBySlot(it.prompt);
    for (const s of SLOTS) {
      const v = (outfit[s.key] || "").trim();
      if (v && !seen[s.key].has(v.toLowerCase())) { seen[s.key].add(v.toLowerCase()); pools[s.key].push(v); }
    }
  }
  const total = SLOTS.reduce((n, s) => n + pools[s.key].length, 0);
  if (total > 0) {
    THEMES.history = { label: "⭐ 履歴から", slots: pools };
  } else {
    delete THEMES.history;
  }
  renderThemes();
}

// ComfyUI プロンプトから positive を取り出す（control.js と同じロジック）
function extractPositive(promptObj) {
  for (const node of Object.values(promptObj)) {
    const title = (node._meta && node._meta.title || "").toLowerCase();
    const type = (node.class_type || "").toLowerCase();
    if ((type === "cliptextencode" || type === "primitivestringmultiline") && ["positive", "ポジティブ"].some(k => title.includes(k)))
      return (node.inputs && (node.inputs.value || node.inputs.text)) || "";
  }
  for (const node of Object.values(promptObj)) {
    const title = (node._meta && node._meta.title || "").toLowerCase();
    const type = (node.class_type || "").toLowerCase();
    if ((type === "cliptextencode" || type === "primitivestringmultiline") && !["negative", "ネガティブ", "neg"].some(k => title.includes(k)))
      return (node.inputs && (node.inputs.value || node.inputs.text)) || "";
  }
  return "";
}

// ===== この衣装でプレビュー生成（コントロール画面のプロンプトは汚さない）=====
let previewBusy = false;
async function generatePreview() {
  const outfit = buildString();
  if (!outfit) { toast("衣装が空です。🎲を押してください", "#f9e2af"); return; }
  if (previewBusy) return;
  previewBusy = true;
  const btn = document.getElementById("btn-gen");
  const spinner = document.getElementById("gen-spinner");
  const placeholder = document.getElementById("gen-placeholder");
  const imgEl = document.getElementById("gen-img");
  const caption = document.getElementById("gen-caption");
  const badge = document.getElementById("gen-badge");
  btn.disabled = true; btn.textContent = "生成中...";
  imgEl.style.display = "none"; imgEl.removeAttribute("src"); badge.style.display = "none"; caption.textContent = "";
  spinner.style.display = "none"; // 状況は中央テキストで常に見えるように出す
  const setStage = (m) => { placeholder.textContent = m; placeholder.style.display = "block"; };
  const showGenError = (m) => { setStage("⚠️ " + m); toast(m, "#f38ba8"); };
  setStage("⏳ 準備中…");
  const t0 = performance.now();
  try {
    // 直近の生成ワークフローを土台にする（本体の設定・モデルをそのまま利用）
    const history = await bgFetch(`${COMFYUI_BASE}/history`);
    const keys = Object.keys(history);
    if (!keys.length) { showGenError("土台にする履歴がありません。まず本体で1枚生成してください"); return; }
    // プレビュー自身(costume_preview/)を土台にすると小さい解像度のまま→真っ黒になるので、
    // 直近の「通常生成」を土台にする（プレビュー履歴はスキップ）
    let baseKey = null;
    for (let i = keys.length - 1; i >= 0; i--) {
      const entry = history[keys[i]];
      if (!entry || !entry.prompt || !entry.prompt[2]) continue;
      let isPreview = false;
      for (const out of Object.values(entry.outputs || {})) {
        for (const img of (out.images || [])) {
          if ((img.subfolder || "").startsWith("costume_preview")) isPreview = true;
        }
      }
      if (!isPreview) { baseKey = keys[i]; break; }
    }
    if (!baseKey) { showGenError("土台にする通常生成が見つかりません。本体で普通に1枚生成してから試してください"); return; }
    const workflow = JSON.parse(JSON.stringify(history[baseKey].prompt[2]));
    // 土台の解像度を確認用に取得（真っ黒対策：小さすぎないか一目で分かる）
    let baseSize = "";
    for (const node of Object.values(workflow)) {
      const t = (node.class_type || "").toLowerCase();
      if (t.includes("latent") && node.inputs && typeof node.inputs.width === "number") { baseSize = `${node.inputs.width}x${node.inputs.height}`; break; }
    }
    setStage("⏳ 準備中… 土台 " + (baseSize || "?"));

    // プレビュー用プロンプト（全身が見えるよう指定）＋ 衣装
    const base = (document.getElementById("gen-prompt").value || "").trim() || DEFAULT_GEN_PROMPT;
    const prompt = base + ", " + outfit;
    for (const node of Object.values(workflow)) {
      const title = (node._meta && node._meta.title || "").toLowerCase();
      const type = (node.class_type || "").toLowerCase();
      if ((type === "cliptextencode" || type === "primitivestringmultiline") && ["positive", "ポジティブ"].some(k => title.includes(k))) {
        if ("value" in node.inputs) node.inputs.value = prompt; else node.inputs.text = prompt;
        break;
      }
    }
    // 軽いプレビュー：土台が大きいときだけ解像度を半分に（/64スナップでモデル安全）＋stepsを最大8＋seedランダム化。
    let info = "", genSize = "";
    for (const node of Object.values(workflow)) {
      const type = (node.class_type || "").toLowerCase();
      if (type.includes("latent") && node.inputs && typeof node.inputs.width === "number" && typeof node.inputs.height === "number") {
        if (Math.max(node.inputs.width, node.inputs.height) >= 1024) { // 十分大きいときだけ縮小（小さすぎ→真っ黒を回避）
          node.inputs.width = Math.max(384, Math.round(node.inputs.width * 0.5 / 64) * 64);
          node.inputs.height = Math.max(384, Math.round(node.inputs.height * 0.5 / 64) * 64);
        }
        genSize = `${node.inputs.width}x${node.inputs.height}`;
      }
      if (type === "ksampler" && node.inputs) {
        if ("seed" in node.inputs) node.inputs.seed = Math.floor(Math.random() * 2 ** 32);
        if (typeof node.inputs.steps === "number") {
          node.inputs.steps = Math.min(node.inputs.steps, 8);
          info = `${node.inputs.steps}steps`;
        }
      } else if (type === "ksampleradvanced" && node.inputs) {
        if ("noise_seed" in node.inputs) node.inputs.noise_seed = Math.floor(Math.random() * 2 ** 32);
        else if ("seed" in node.inputs) node.inputs.seed = Math.floor(Math.random() * 2 ** 32);
      }
      // プレビューは専用サブフォルダに保存（通常の出力を汚さない）
      if (node.class_type === "SaveImage" && node.inputs) {
        node.inputs.filename_prefix = "costume_preview/preview";
      }
    }

    const q = await bgFetch(`${COMFYUI_BASE}/prompt`, "POST", { prompt: workflow, client_id: "costume_ext" });
    if (q && q.node_errors && Object.keys(q.node_errors).length) {
      showGenError("ワークフローのエラー: " + JSON.stringify(q.node_errors).slice(0, 180)); return;
    }
    const pid = q && q.prompt_id;
    if (!pid) { showGenError("キュー送信に失敗（prompt_idが返らない）"); return; }

    // 結果をポーリング（output/temp どちらの画像も拾う。ComfyUI側エラーも検出）
    const deadline = performance.now() + 180000;
    let url = null, execErr = null;
    while (performance.now() < deadline && !url && !execErr) {
      await new Promise(r => setTimeout(r, 400));
      setStage(`⏳ 生成中… ${((performance.now() - t0) / 1000).toFixed(0)}s ／ 土台 ${baseSize || "?"}`);
      const data = await bgFetch(`${COMFYUI_BASE}/history/${pid}`);
      const entry = data && data[pid];
      if (!entry) continue;
      if (entry.status && entry.status.status_str === "error") { execErr = "ComfyUI側で生成エラー（ワークフローを確認）"; break; }
      for (const out of Object.values(entry.outputs || {})) {
        for (const img of (out.images || [])) {
          const type = img.type || "output";
          url = `${COMFYUI_BASE}/api/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || "")}&type=${type}`;
          break;
        }
        if (url) break;
      }
    }
    if (execErr) { showGenError(execErr); return; }
    if (!url) { showGenError("タイムアウト（画像が見つからない）。SaveImageノードのあるワークフローで一度本体生成してください"); return; }
    // 画像は onload で「読み込めた」ことを確認してから表示（黙って消えるのを防ぐ）
    setStage("⏳ 画像を読み込み中…");
    imgEl.onload = () => {
      placeholder.style.display = "none";
      imgEl.style.display = "block";
      badge.style.display = "block";
      caption.textContent = `${genSize ? genSize + " / " : ""}${info ? info + " / " : ""}${((performance.now() - t0) / 1000).toFixed(1)}s`;
      previewList.unshift({ url, prompt }); // 過去プレビュー履歴の先頭に追加
      genIndex = 0;
      document.getElementById("gen-counter").textContent = `${genIndex + 1} / ${previewList.length}`;
      renderGen3();
    };
    imgEl.onerror = () => showGenError("画像の読み込みに失敗: " + url);
    imgEl.src = url;
  } catch (e) {
    showGenError("生成に失敗: " + (e.message || e));
  } finally {
    btn.disabled = false; btn.textContent = "▶ この衣装で生成";
    previewBusy = false;
  }
}

// ===== イベント =====
document.getElementById("btn-gen").addEventListener("click", generatePreview);
document.getElementById("btn-roll").addEventListener("click", rollAll);
document.getElementById("btn-ai").addEventListener("click", aiPropose);
document.getElementById("btn-gallery-refresh").addEventListener("click", loadGallery);
document.getElementById("gallery-filter").addEventListener("input", applyRefFilter);
document.getElementById("ref-prev").addEventListener("click", () => { if (refPage > 0) { refPage--; renderRefPage(); } });
document.getElementById("ref-next").addEventListener("click", () => {
  const pages = Math.ceil(refList.length / REF_PAGE);
  if (refPage < pages - 1) { refPage++; renderRefPage(); }
});
// 右上プレビュー枠：過去プレビューを◀（古い）▶（新しい）で見返す
document.getElementById("gen-prev").addEventListener("click", () => { if (genIndex < previewList.length - 1) showPreviewAt(genIndex + 1); });
document.getElementById("gen-next").addEventListener("click", () => { if (genIndex > 0) showPreviewAt(genIndex - 1); });
document.getElementById("btn-reserve").addEventListener("click", reserveCurrent);


document.getElementById("btn-copy").addEventListener("click", async () => {
  const str = buildString(); if (!str) return;
  const b = document.getElementById("btn-copy");
  try { await navigator.clipboard.writeText(str); b.textContent = "✅ コピー"; }
  catch (e) { b.textContent = "❌ 失敗"; }
  setTimeout(() => b.textContent = "📋 コピー", 1200);
});

document.getElementById("btn-send").addEventListener("click", () => {
  const str = buildString();
  if (!str) { toast("衣装が空です。🎲を押してください", "#f9e2af"); return; }
  // 日本語欄には英語のまま入れる（自動和訳は精度が悪いため）
  chrome.runtime.sendMessage({ type: "USE_IN_CONTROL", text: str, append: true, japanese: str }, () => {
    toast("✍️ コントロール画面に送りました");
  });
});

// ===== 起動 =====
(function init() {
  renderThemes();
  // プレビュー用プロンプト欄：保存値 or 既定値をセットし、変更を保存
  const gp = document.getElementById("gen-prompt");
  chrome.storage.local.get("costume_gen_prompt", (d) => {
    gp.value = (d && d.costume_gen_prompt) || DEFAULT_GEN_PROMPT;
  });
  gp.addEventListener("change", () => {
    chrome.storage.local.set({ costume_gen_prompt: gp.value.trim() });
  });
  // お取り置きを復元
  chrome.storage.local.get("costume_reserved", (d) => {
    reservedList = (d && Array.isArray(d.costume_reserved)) ? d.costume_reserved : [];
    renderReserve();
  });
  // 保存状態を復元（無ければ初期ガチャ）
  chrome.storage.local.get("costume_state_full", (d) => {
    const saved = d && d.costume_state_full;
    if (saved && saved.slots) {
      if (THEMES[saved.theme]) state.theme = saved.theme;
      for (const s of SLOTS) {
        if (saved.slots[s.key]) state.slots[s.key] = { value: saved.slots[s.key].value || "", locked: !!saved.slots[s.key].locked };
      }
      renderThemes(); render();
    } else {
      rollAll();
    }
  });
  // 接続先が確定してから履歴ギャラリーを読む
  comfyBaseReady.then(loadGallery);
})();
