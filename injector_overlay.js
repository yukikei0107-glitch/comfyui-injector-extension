// フローティング単語注入オーバーレイ
// 普段は右下の丸ボタン。押すと単語パネルが展開し、
// クリックした単語を「直前にフォーカスしていた入力欄」へ挿入する。
// 各単語は { ja: 日本語訳, en: 英単語 } のセットで、グリッド表示する。
(() => {
  if (window.__wordInjectorLoaded) return;
  window.__wordInjectorLoaded = true;

  const STORAGE_KEY = "wordInjectorWords";   // [{ja,en}, ...]
  const POS_KEY = "wordInjectorPos";          // {right, bottom}

  const DEFAULT_WORDS = [
    { ja: "傑作", en: "masterpiece" }, { ja: "最高品質", en: "best quality" },
    { ja: "高精細", en: "highly detailed" }, { ja: "超精細", en: "ultra detailed" },
    { ja: "8K", en: "8k" }, { ja: "4K", en: "4k" },
    { ja: "写真風", en: "photorealistic" }, { ja: "リアル", en: "realistic" },
    { ja: "映画的照明", en: "cinematic lighting" }, { ja: "柔らかい光", en: "soft lighting" },
    { ja: "劇的な照明", en: "dramatic lighting" }, { ja: "逆光", en: "backlighting" },
    { ja: "被写界深度", en: "depth of field" }, { ja: "ボケ", en: "bokeh" },
    { ja: "シャープ", en: "sharp focus" }, { ja: "緻密", en: "intricate details" },
    { ja: "鮮やかな色", en: "vibrant colors" }, { ja: "パステル", en: "pastel colors" },
    { ja: "モノクロ", en: "monochrome" }, { ja: "高コントラスト", en: "high contrast" },
    { ja: "ポートレート", en: "portrait" }, { ja: "全身", en: "full body" },
    { ja: "アップ", en: "close-up" }, { ja: "引きの絵", en: "wide shot" },
    { ja: "俯瞰", en: "from above" }, { ja: "あおり", en: "from below" },
    { ja: "ダイナミックポーズ", en: "dynamic pose" }, { ja: "視線こちら", en: "looking at viewer" },
    { ja: "笑顔", en: "smile" }, { ja: "整った顔", en: "detailed face" },
    { ja: "綺麗な目", en: "beautiful eyes" }, { ja: "精細な目", en: "detailed eyes" },
    { ja: "長髪", en: "long hair" }, { ja: "短髪", en: "short hair" },
    { ja: "屋外", en: "outdoors" }, { ja: "屋内", en: "indoors" },
    { ja: "自然背景", en: "nature background" }, { ja: "都市背景", en: "city background" },
    { ja: "シンプル背景", en: "simple background" }, { ja: "白背景", en: "white background" },
    { ja: "夕焼け", en: "sunset" }, { ja: "夜", en: "night" },
    { ja: "朝の光", en: "morning light" }, { ja: "ファンタジー", en: "fantasy" },
    { ja: "SF", en: "sci-fi" }, { ja: "水彩", en: "watercolor" },
    { ja: "油彩", en: "oil painting" }, { ja: "アニメ調", en: "anime style" },
    { ja: "コンセプトアート", en: "concept art" }, { ja: "ジブリ風", en: "studio ghibli style" },
    { ja: "フィルムグレイン", en: "film grain" }, { ja: "霧", en: "fog" },
    { ja: "雨", en: "rain" }, { ja: "雪", en: "snow" },
    { ja: "桜", en: "cherry blossoms" }, { ja: "森", en: "forest" },
    { ja: "海", en: "ocean" }, { ja: "空", en: "sky" },
    { ja: "星空", en: "starry sky" }, { ja: "ネオン", en: "neon lights" }
  ];

  const COLS = 6;

  // --- 直前にフォーカスしていた編集可能要素を記憶 ---
  let lastEditable = null;

  function isEditable(el) {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === "TEXTAREA") return true;
    if (tag === "INPUT") {
      const t = (el.type || "text").toLowerCase();
      return ["text", "search", "url", "email", "tel", "password", ""].includes(t);
    }
    if (el.isContentEditable) return true;
    return false;
  }

  document.addEventListener("focusin", (e) => {
    const t = e.target;
    if (t && t.closest && t.closest("#__word-injector-root")) return;
    if (isEditable(t)) lastEditable = t;
  }, true);

  // --- 入力欄へテキストを挿入 ---
  function insertText(text) {
    const el = lastEditable;
    if (!el || !document.contains(el)) {
      flash("挿入先の入力欄が見つかりません。先に入力欄をクリックしてください。", true);
      return;
    }
    el.focus();

    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const before = el.value.slice(0, start);
      const after = el.value.slice(end);
      const needSep = before.length > 0 && !/[\s,]$/.test(before);
      const ins = (needSep ? ", " : "") + text;

      const proto = el.tagName === "TEXTAREA"
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      const newValue = before + ins + after;
      if (setter) setter.call(el, newValue); else el.value = newValue;

      const caret = before.length + ins.length;
      el.setSelectionRange(caret, caret);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    } else if (el.isContentEditable) {
      el.focus();
      const sel = window.getSelection();
      let needSep = false;
      const node = sel && sel.anchorNode;
      if (node && node.textContent) {
        const prev = node.textContent.slice(0, sel.anchorOffset);
        needSep = prev.length > 0 && !/[\s,]$/.test(prev);
      }
      const ins = (needSep ? ", " : "") + text;
      document.execCommand("insertText", false, ins);
    }
    flash(`挿入: ${text}`);
  }

  // --- Shadow DOM UI ---
  const host = document.createElement("div");
  host.id = "__word-injector-root";
  host.style.cssText = "position:fixed;z-index:2147483647;right:20px;bottom:20px;";
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    * { box-sizing: border-box; font-family: "Helvetica Neue", system-ui, sans-serif; }
    .fab {
      width: 48px; height: 48px; border-radius: 50%;
      background: #89b4fa; color: #1e1e2e; border: none; cursor: grab;
      font-size: 22px; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,.35);
      display: flex; align-items: center; justify-content: center;
      transition: transform .1s ease; touch-action: none;
    }
    .fab:hover { transform: scale(1.08); }
    .fab.dragging { cursor: grabbing; transform: scale(1.05); }
    .panel {
      position: absolute; right: 0; bottom: 60px;
      width: 560px; max-height: 70vh; overflow: hidden;
      background: #1e1e2e; color: #cdd6f4; border: 1px solid #313244;
      border-radius: 12px; box-shadow: 0 8px 28px rgba(0,0,0,.5);
      display: none; flex-direction: column;
    }
    .panel.open { display: flex; }
    .hd {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 12px; border-bottom: 1px solid #313244;
    }
    .hd .title { font-size: 13px; font-weight: bold; color: #89b4fa; flex: 1; }
    .hd button {
      background: #313244; color: #cdd6f4; border: none; border-radius: 6px;
      padding: 4px 10px; font-size: 12px; cursor: pointer;
    }
    .hd button:hover { background: #45475a; }
    .search {
      margin: 8px 12px 0; padding: 6px 10px; border-radius: 6px;
      border: 1px solid #313244; background: #11111b; color: #cdd6f4;
      font-size: 13px; outline: none;
    }
    .grid {
      display: grid; grid-template-columns: repeat(${COLS}, 1fr);
      gap: 6px; padding: 10px 12px; overflow-y: auto;
    }
    .cell {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: #313244; border: 1px solid #45475a; border-radius: 8px;
      padding: 5px 4px; cursor: pointer; user-select: none; min-height: 42px;
      text-align: center;
    }
    .cell:hover { background: #585b70; border-color: #89b4fa; }
    .cell .ja { font-size: 11px; color: #f9e2af; line-height: 1.2; word-break: break-all; }
    .cell .en { font-size: 11px; color: #cdd6f4; line-height: 1.2; word-break: break-all; margin-top: 1px; }
    .editor { display: none; flex-direction: column; padding: 10px 12px; gap: 8px; }
    .editor.open { display: flex; }
    .editor textarea {
      width: 100%; height: 220px; resize: vertical;
      background: #11111b; color: #cdd6f4; border: 1px solid #313244;
      border-radius: 6px; padding: 8px; font-size: 13px; outline: none;
    }
    .editor .hint { font-size: 11px; color: #7f849c; }
    .editor .save {
      align-self: flex-end; background: #a6e3a1; color: #1e1e2e;
      border: none; border-radius: 6px; padding: 6px 16px; font-size: 12px;
      font-weight: bold; cursor: pointer;
    }
    .toast {
      position: absolute; right: 0; bottom: 60px;
      background: #11111b; color: #cdd6f4; border: 1px solid #313244;
      border-radius: 8px; padding: 8px 12px; font-size: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,.4); opacity: 0; pointer-events: none;
      transition: opacity .2s ease; max-width: 300px;
    }
    .toast.show { opacity: 1; }
    .toast.err { border-color: #f38ba8; color: #f38ba8; }
  `;
  shadow.appendChild(style);

  const fab = document.createElement("button");
  fab.className = "fab";
  fab.textContent = "📝";
  fab.title = "単語注入パネル（ドラッグで移動）";

  const panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = `
    <div class="hd">
      <span class="title">単語注入</span>
      <button class="edit-btn">編集</button>
    </div>
    <input class="search" type="text" placeholder="日本語・英語で絞り込み..." />
    <div class="grid"></div>
    <div class="editor">
      <div class="hint">1行に1セット。「日本語=英単語」の形式で入力（例: 傑作=masterpiece）。</div>
      <textarea spellcheck="false"></textarea>
      <button class="save">保存</button>
    </div>
  `;

  const toast = document.createElement("div");
  toast.className = "toast";

  shadow.appendChild(panel);
  shadow.appendChild(toast);
  shadow.appendChild(fab);

  const gridEl = panel.querySelector(".grid");
  const searchEl = panel.querySelector(".search");
  const editorEl = panel.querySelector(".editor");
  const editBtn = panel.querySelector(".edit-btn");
  const textareaEl = panel.querySelector(".editor textarea");
  const saveBtn = panel.querySelector(".save");

  let words = [];

  let toastTimer = null;
  function flash(msg, isErr) {
    toast.textContent = msg;
    toast.classList.toggle("err", !!isErr);
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
  }

  function renderGrid(filter) {
    gridEl.innerHTML = "";
    const f = (filter || "").trim().toLowerCase();
    const list = f
      ? words.filter(w => (w.ja + " " + w.en).toLowerCase().includes(f))
      : words;
    for (const w of list) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.title = `${w.ja} → ${w.en}`;
      const ja = document.createElement("div");
      ja.className = "ja"; ja.textContent = w.ja;
      const en = document.createElement("div");
      en.className = "en"; en.textContent = w.en;
      cell.appendChild(ja); cell.appendChild(en);
      cell.addEventListener("mousedown", (e) => e.preventDefault());
      cell.addEventListener("click", () => insertText(w.en));
      gridEl.appendChild(cell);
    }
  }

  function loadWords() {
    chrome.storage.local.get([STORAGE_KEY, POS_KEY], (res) => {
      const stored = res[STORAGE_KEY];
      words = Array.isArray(stored) && stored.length && typeof stored[0] === "object"
        ? stored
        : DEFAULT_WORDS.slice();
      renderGrid(searchEl.value);
      const pos = res[POS_KEY];
      if (pos && typeof pos.right === "number") {
        host.style.right = pos.right + "px";
        host.style.bottom = pos.bottom + "px";
      }
    });
  }

  function saveWords(list) {
    words = list;
    chrome.storage.local.set({ [STORAGE_KEY]: list }, () => {
      renderGrid(searchEl.value);
      flash(`保存しました (${list.length}セット)`);
    });
  }

  searchEl.addEventListener("input", () => renderGrid(searchEl.value));

  editBtn.addEventListener("click", () => {
    const opening = !editorEl.classList.contains("open");
    editorEl.classList.toggle("open", opening);
    editBtn.textContent = opening ? "閉じる" : "編集";
    if (opening) textareaEl.value = words.map(w => `${w.ja}=${w.en}`).join("\n");
  });

  saveBtn.addEventListener("mousedown", (e) => e.preventDefault());
  saveBtn.addEventListener("click", () => {
    const list = textareaEl.value.split("\n").map(line => {
      const i = line.indexOf("=");
      if (i < 0) {
        const t = line.trim();
        return t ? { ja: t, en: t } : null;
      }
      const ja = line.slice(0, i).trim();
      const en = line.slice(i + 1).trim();
      if (!en && !ja) return null;
      return { ja: ja || en, en: en || ja };
    }).filter(Boolean);
    saveWords(list);
    editorEl.classList.remove("open");
    editBtn.textContent = "編集";
  });

  // --- ドラッグ移動（クリックと区別） ---
  let dragState = null;
  fab.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    const rect = host.getBoundingClientRect();
    dragState = {
      startX: e.clientX, startY: e.clientY,
      // right/bottom 基準の現在位置
      right: window.innerWidth - rect.right,
      bottom: window.innerHeight - rect.bottom,
      moved: false
    };
    e.preventDefault();
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragState) return;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    if (!dragState.moved && Math.hypot(dx, dy) > 4) {
      dragState.moved = true;
      fab.classList.add("dragging");
    }
    if (dragState.moved) {
      let right = dragState.right - dx;
      let bottom = dragState.bottom - dy;
      right = Math.max(0, Math.min(window.innerWidth - 48, right));
      bottom = Math.max(0, Math.min(window.innerHeight - 48, bottom));
      host.style.right = right + "px";
      host.style.bottom = bottom + "px";
    }
  });
  window.addEventListener("mouseup", () => {
    if (!dragState) return;
    fab.classList.remove("dragging");
    if (dragState.moved) {
      // 移動完了 → 位置を保存
      const rect = host.getBoundingClientRect();
      const right = window.innerWidth - rect.right;
      const bottom = window.innerHeight - rect.bottom;
      chrome.storage.local.set({ [POS_KEY]: { right, bottom } });
    } else {
      // 動かなかった → クリック扱いでパネル開閉
      panel.classList.toggle("open");
      if (panel.classList.contains("open")) renderGrid(searchEl.value);
    }
    dragState = null;
  });

  document.documentElement.appendChild(host);
  loadWords();
})();
