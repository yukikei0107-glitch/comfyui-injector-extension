const STORAGE_KEY = "prompt_dict";

// 起動確認（このログが出れば新コードが動いている証拠）
console.log("%c[辞書] dict.js v3 起動（保存検証版）", "color:#89b4fa;font-weight:bold");
chrome.storage.local.getBytesInUse(null, b => console.log(`[辞書] 起動時ストレージ使用量: ${b.toLocaleString()} bytes`));

// 画面下に一瞬出る通知（トースト）
let _toastTimer = null;
function toast(msg, color = "#a6e3a1") {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.style.background = color;
  el.style.opacity = "1";
  el.style.transform = "translateX(-50%) translateY(0)";
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateX(-50%) translateY(20px)";
  }, 3500);
}

// 辞書件数更新
function updateDictCount(count) {
  const el = document.getElementById("dict-count");
  if (el) el.textContent = `(${count}件)`;
}

// データ読み込み
async function loadDict() {
  return new Promise(resolve => {
    chrome.storage.local.get(STORAGE_KEY, (data) => {
      resolve(data[STORAGE_KEY] || {});
    });
  });
}

// データ保存（成功:true / 失敗:false）
// ※ 以前は chrome.runtime.lastError を見ておらず、保存失敗でも成功扱いになっていた
async function saveDict(dict) {
  const ok = await new Promise(resolve => {
    chrome.storage.local.set({ [STORAGE_KEY]: dict }, () => {
      if (chrome.runtime.lastError) {
        const msg = chrome.runtime.lastError.message || "不明なエラー";
        console.error("[辞書] 内部ストレージへの保存に失敗:", msg);
        chrome.storage.local.getBytesInUse(null, b => console.error(`[辞書] 現在の使用量: ${b} bytes / エントリ数: ${Object.keys(dict).length}`));
        setAutosaveStatus("⚠️ 保存失敗: " + msg, "#f38ba8");
        resolve(false);
        return;
      }
      chrome.storage.local.getBytesInUse(null, b => console.log(`[辞書] 保存OK: ${Object.keys(dict).length}件 / 使用量 ${b.toLocaleString()} bytes`));
      resolve(true);
    });
  });
  if (!ok) return false;
  // 自動保存先が設定されていれば実ファイルにも書き込む（検証前に完了させるため await）
  await autoSaveToFile(dict);
  return true;
}

// ===== 自動ファイル保存（File System Access API） =====
// 選んだファイルへの参照(handle)を IndexedDB に保存して、再起動後も使えるようにする
let autoSaveHandle = null;

function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("dict_autosave_db", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("kv");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbSet(key, val) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("kv", "readwrite");
    tx.objectStore("kv").put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbGet(key) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("kv", "readonly");
    const r = tx.objectStore("kv").get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function setAutosaveStatus(msg, color) {
  const el = document.getElementById("autosave-status");
  if (el) { el.textContent = msg; el.style.color = color || "#6c7086"; }
  const offBtn = document.getElementById("btn-autosave-off");
  if (offBtn) offBtn.style.display = autoSaveHandle ? "inline-block" : "none";
}

// 実ファイルへ書き込む（バックアップ形式：辞書＋タグ候補＋日時。そのまま「復元」で戻せる）
async function autoSaveToFile(dict) {
  if (!autoSaveHandle) return;
  const newCount = dict ? Object.keys(dict).length : 0;
  // 空（0件）の辞書でファイルを上書きしない＝全消し事故を防ぐ安全装置
  if (newCount === 0) {
    console.warn("[辞書] 空の辞書のためファイル書き込みをスキップ（バックアップ保護）");
    return;
  }
  try {
    let perm = await autoSaveHandle.queryPermission({ mode: "readwrite" });
    if (perm !== "granted") {
      // ユーザー操作（クリック等）の流れの中なら許可を要求できる
      perm = await autoSaveHandle.requestPermission({ mode: "readwrite" });
      if (perm !== "granted") { setAutosaveStatus("⚠️ 書き込み権限がありません（保存先を再設定してください）", "#f9e2af"); return; }
    }
    // 既存ファイルの件数を読み、件数が激減する書き込みは拒否（ストレージ破損時の全消しを防ぐ）
    try {
      const curFile = await autoSaveHandle.getFile();
      const curText = await curFile.text();
      if (curText.trim()) {
        const curCount = Object.keys((JSON.parse(curText).prompt_dict) || {}).length;
        if (curCount >= 50 && newCount < curCount * 0.5) {
          console.warn(`[辞書] 件数が激減(${curCount}→${newCount})のため保存を中止（ファイル保護）`);
          setAutosaveStatus(`🛑 件数が急減(${curCount}→${newCount})のため保存中止。復元してください`, "#f38ba8");
          return;
        }
      }
    } catch (e) { /* 既存が読めない/新規ファイルならそのまま書き込む */ }
    // タグ候補も取得してバックアップ形式で書き出す（btn-backupと同じ構造）
    const tags = await new Promise(resolve => {
      chrome.storage.local.get("tag_suggestions", d => resolve(d["tag_suggestions"] || []));
    });
    const backup = {
      version: "1.0",
      date: new Date().toISOString(),
      prompt_dict: dict,
      tag_suggestions: tags
    };
    const w = await autoSaveHandle.createWritable();
    await w.write(JSON.stringify(backup, null, 2));
    await w.close();
    const t = new Date().toLocaleTimeString();
    setAutosaveStatus(`✅ ${autoSaveHandle.name} に保存 (${t})`, "#a6e3a1");
  } catch (e) {
    setAutosaveStatus("⚠️ 保存に失敗: " + e.message, "#f38ba8");
  }
}

// 保存先ファイルを選ぶ
async function chooseAutosaveFile() {
  if (!window.showSaveFilePicker) {
    alert("このブラウザはファイル自動保存に未対応です（Chrome系で利用できます）");
    return;
  }
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: "comfyui_dict_autosave.json",
      types: [{ description: "JSON", accept: { "application/json": [".json"] } }]
    });
    autoSaveHandle = handle;
    await idbSet("handle", handle);
    setAutosaveStatus(`設定完了：${handle.name}`, "#a6e3a1");
    // 既存ファイルに辞書があればマージして取り込む（空の辞書でファイルを上書きする事故を防ぐ）
    await syncFromFile(true);
  } catch (e) {
    if (e.name !== "AbortError") alert("保存先の設定に失敗しました: " + e.message);
  }
}

// ファイルの辞書を読み込み、現在のストレージとマージして正本にする
// （union：両方のキーを残すので、ストレージが飛んでいてもファイルから復活し、
//  逆にファイルに無い最近の追加も失わない。＝これで「リロードで消える」を根絶）
async function syncFromFile(interactive) {
  if (!autoSaveHandle) return false;
  try {
    let perm = await autoSaveHandle.queryPermission({ mode: "readwrite" });
    if (perm !== "granted") {
      if (!interactive) return false; // 起動時（クリック無し）は権限要求できないので静かに諦める
      perm = await autoSaveHandle.requestPermission({ mode: "readwrite" });
      if (perm !== "granted") { setAutosaveStatus("⚠️ 読み込み権限がありません", "#f9e2af"); return false; }
    }
    const file = await autoSaveHandle.getFile();
    const text = await file.text();
    let fileDict = {}, fileTags = null;
    if (text.trim()) {
      try { const backup = JSON.parse(text); fileDict = backup.prompt_dict || {}; fileTags = backup.tag_suggestions || null; } catch (e) { fileDict = {}; }
    }
    const storeDict = await loadDict();
    // 値の衝突はストレージ側を優先（最近の編集を尊重）。ファイルにしか無いキーも取り込む
    const merged = Object.assign({}, fileDict, storeDict);
    const grew = Object.keys(merged).length;
    if (grew === 0) { setAutosaveStatus("⚠️ ファイルもストレージも空です", "#f9e2af"); return false; } // 両方空なら何もしない
    await saveDict(merged); // ストレージ保存＋ファイル書き戻し（両方を最新化）
    // タグ候補：ストレージが空ならファイルから補完
    if (fileTags && fileTags.length) {
      const cur = await new Promise(r => chrome.storage.local.get("tag_suggestions", d => r(d.tag_suggestions)));
      if (!cur || !cur.length) await chrome.storage.local.set({ tag_suggestions: fileTags });
    }
    console.log(`[辞書] ファイル同期: file=${Object.keys(fileDict).length} / storage=${Object.keys(storeDict).length} → 統合 ${grew}件`);
    await renderList(document.getElementById("filter-input").value);
    setAutosaveStatus(`✅ ファイルと同期 (${grew}件)`, "#a6e3a1");
    return true;
  } catch (e) {
    console.error("[辞書] ファイル同期に失敗:", e);
    if (interactive) setAutosaveStatus("⚠️ ファイル読込に失敗: " + e.message, "#f38ba8");
    return false;
  }
}

// 起動時：保存済みの handle を復元し、権限があればファイルから自動読み込み（正本＝ファイル）
(async () => {
  try {
    const h = await idbGet("handle");
    if (!h) return;
    autoSaveHandle = h;
    const perm = await h.queryPermission({ mode: "readwrite" });
    if (perm === "granted") {
      setAutosaveStatus(`✅ 自動保存ON：${h.name}`, "#a6e3a1");
      await syncFromFile(false); // ← リロード後もここでファイルから辞書が復活する
    } else {
      // 権限が切れている＝クリックで復活。ボタンを目立たせて促す
      setAutosaveStatus(`📂 「ファイルから読込」を押すと辞書を復元します：${h.name}`, "#f9e2af");
    }
  } catch (e) {}
})();

document.getElementById("btn-load-from-file").addEventListener("click", () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    let text;
    try { text = await file.text(); } catch (err) { console.error("[辞書] file.text() 失敗:", err); toast("読込失敗: " + err.message, "#f38ba8"); return; }
    let fileDict = {}, fileTags = null;
    try {
      const backup = JSON.parse(text);
      fileDict = backup.prompt_dict || {};
      fileTags = backup.tag_suggestions || null;
    } catch (err) { console.error("[辞書] JSON.parse 失敗:", err); toast("JSON解析失敗: " + err.message, "#f38ba8"); return; }
    if (Object.keys(fileDict).length === 0) { toast("ファイルに辞書データがありません", "#f9e2af"); return; }
    const storeDict = await loadDict();
    const merged = Object.assign({}, fileDict, storeDict);
    await saveDict(merged);
    if (fileTags && fileTags.length) {
      const cur = await new Promise(r => chrome.storage.local.get("tag_suggestions", d => r(d.tag_suggestions)));
      if (!cur || !cur.length) await chrome.storage.local.set({ tag_suggestions: fileTags });
    }
    await renderList(document.getElementById("filter-input").value);
    toast(`✅ ファイルから読込完了（${Object.keys(merged).length}件）`, "#a6e3a1");
  };
  input.click();
});

// 📌 永久保存：現在の辞書を同梱用 dict_data.js として書き出す。
// ダウンロードしたファイルを拡張フォルダに上書き→リロードすれば、新規追加分も
// 「工場出荷時データ」に固定され、総破損・拡張削除でも全件復活する。
document.getElementById("btn-export-bundle").addEventListener("click", async () => {
  const dict = await loadDict();
  const count = Object.keys(dict).length;
  if (count === 0) { toast("辞書が空です。書き出しません", "#f38ba8"); return; }
  const tags = await new Promise(r => chrome.storage.local.get("tag_suggestions", d => r(d["tag_suggestions"] || [])));
  const header =
    "// 拡張に同梱した辞書データ（工場出荷時データ）。\n" +
    "// ストレージが空のとき dict.js が自動でこれを読み込むので、\n" +
    "// 拡張をリロード/アップデートしてもこの件数分は消えない。\n" +
    "// 書き出し日時: " + new Date().toLocaleString() + " / " + count + "件\n";
  const body =
    "window.__BUNDLED_DICT__ = " + JSON.stringify(dict) + ";\n" +
    "window.__BUNDLED_TAGS__ = " + JSON.stringify(tags) + ";\n";
  const blob = new Blob([header + body], { type: "application/javascript" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "dict_data.js";
  a.click();
  URL.revokeObjectURL(url);
  toast(`📌 dict_data.js を書き出しました（${count}件）。拡張フォルダに上書きしてリロード`, "#a6e3a1");
});

document.getElementById("btn-autosave-set").addEventListener("click", chooseAutosaveFile);
document.getElementById("btn-autosave-off").addEventListener("click", async () => {
  autoSaveHandle = null;
  await idbSet("handle", null);
  setAutosaveStatus("未設定（追加してもファイルには書き込みません）", "#6c7086");
  toast("自動保存を解除しました", "#f9e2af");
});

// 辞書リスト描画
async function renderList(filter = "") {
  const dict = await loadDict();
  const listEl = document.getElementById("dict-list");
  const keys = Object.keys(dict).filter(k =>
    !filter || k.includes(filter) || dict[k].toLowerCase().includes(filter.toLowerCase())
  );

  if (keys.length === 0) {
    listEl.innerHTML = '<div class="empty-msg">エントリがありません</div>';
    return;
  }

  const esc = (s) => String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  listEl.innerHTML = keys.map(ja => `
    <div class="dict-item" data-key="${esc(ja)}">
      <div class="ja">${esc(ja)}</div>
      <div class="en">${esc(dict[ja])}</div>
      <div class="actions">
        <button class="btn-small btn-success btn-edit" data-key="${esc(ja)}" data-en="${esc(dict[ja])}">編集</button>
        <button class="btn-small btn-danger btn-del" data-key="${esc(ja)}">削除</button>
      </div>
    </div>
  `).join("");

  // 編集ボタン（新しいエントリ追加欄に流し込む）
  listEl.querySelectorAll(".btn-edit").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById("add-ja").value = btn.dataset.key;
      document.getElementById("add-en").value = btn.dataset.en;
      document.getElementById("add-ja").focus();
    });
  });

  // 削除ボタン
  listEl.querySelectorAll(".btn-del").forEach(btn => {
    btn.addEventListener("click", async () => {
      const key = btn.dataset.key;
      if (!confirm(`「${key}」を削除しますか？`)) return;
      const dict = await loadDict();
      delete dict[key];
      await saveDict(dict);
      await renderList(document.getElementById("filter-input").value);
    });
  });

  // フィルター表示と件数更新
  document.getElementById("filter-input").value = filter;
  updateDictCount(Object.keys(dict).length);
}

// 変換履歴
let history = [];
function addHistory(ja, en) {
  history = [{ ja, en }, ...history.slice(0, 9)];
  const el = document.getElementById("history-list");
  el.innerHTML = history.map(h =>
    `<div style="cursor:pointer;padding:2px 0;color:#cdd6f4;" class="hist-item" data-en="${h.en}">
      <span style="color:#89b4fa;">${h.ja}</span> → ${h.en.slice(0, 30)}${h.en.length > 30 ? "..." : ""}
    </div>`
  ).join("");
  el.querySelectorAll(".hist-item").forEach(item => {
    item.addEventListener("click", () => {
      showResult(item.dataset.en);
    });
  });
}

function showResult(text) {
  const el = document.getElementById("result-box");
  el.textContent = text;
  el.className = "result-box";
}

// 変換
async function convert(ja) {
  const dict = await loadDict();
  const q = ja.toLowerCase();
  // 完全一致 → 日本語キー部分一致 → 英語の値部分一致（絞り込みと同じ検索範囲）
  let key = dict[ja] ? ja
    : Object.keys(dict).find(k => k.includes(ja))
    || Object.keys(dict).find(k => dict[k].toLowerCase().includes(q));
  if (key) {
    showResult(dict[key]);
    addHistory(key, dict[key]);
  } else {
    const el = document.getElementById("result-box");
    el.textContent = `「${ja}」は辞書に登録されていません`;
    el.className = "result-box empty";
  }
}

// 保存した内容を実際に読み直して、本当に入っているか検証する
// （「保存しました」表示が嘘にならないように。ファイルがあればファイルを正とする）
async function verifySaved(ja, en) {
  // 保存先ファイルがあれば、それを読み直して確認（＝一番確実な永続先）
  if (autoSaveHandle) {
    try {
      const perm = await autoSaveHandle.queryPermission({ mode: "readwrite" });
      if (perm !== "granted") return { ok: false, msg: "⚠️ ファイル権限が切れています。「保存先を設定」で選び直してください" };
      const f = await autoSaveHandle.getFile();
      const t = await f.text();
      const d = t.trim() ? ((JSON.parse(t).prompt_dict) || {}) : {};
      if (d[ja] === en) return { ok: true, msg: `✅ ファイルに保存を確認（${Object.keys(d).length}件）` };
      return { ok: false, msg: "⚠️ ファイルに書けていません。「保存先を設定」で選び直してください" };
    } catch (e) {
      return { ok: false, msg: "⚠️ ファイル確認に失敗: " + e.message };
    }
  }
  // ファイル未設定なら内部ストレージを読み直して確認
  const back = await loadDict();
  if (back[ja] === en) return { ok: true, msg: "✅ 保存しました（内部のみ。保険にファイル保存先の設定を推奨）" };
  return { ok: false, msg: "⚠️ 保存できていません（内部ストレージに書けていない）" };
}

// 追加
async function addEntry() {
  const ja = document.getElementById("add-ja").value.trim();
  const en = document.getElementById("add-en").value.trim();
  if (!ja || !en) { alert("日本語と英語の両方を入力してください"); return; }

  const dict = await loadDict();
  dict[ja] = en;
  const ok = await saveDict(dict);
  if (!ok) { toast("❌ 保存に失敗しました（コンソールにエラー詳細）", "#f38ba8"); return; }

  document.getElementById("add-ja").value = "";
  document.getElementById("add-en").value = "";
  await renderList(document.getElementById("filter-input").value);
  // 実際に読み直して検証してから結果を表示（成功表示を嘘にしない）
  const v = await verifySaved(ja, en);
  toast(v.msg, v.ok ? "#a6e3a1" : "#f38ba8");
}

// イベント
document.getElementById("search-input").addEventListener("input", async (e) => {
  const val = e.target.value.trim();
  if (val) await convert(val);
  else {
    const el = document.getElementById("result-box");
    el.textContent = "キーワードを入力してください";
    el.className = "result-box empty";
  }
});

document.getElementById("btn-clear-search").addEventListener("click", () => {
  const input = document.getElementById("search-input");
  input.value = "";
  input.focus();
  const el = document.getElementById("result-box");
  el.textContent = "キーワードを入力してください";
  el.className = "result-box empty";
});

document.getElementById("search-input").addEventListener("keydown", async (e) => {
  if (e.key === "Enter") await convert(e.target.value.trim());
});

document.getElementById("btn-copy").addEventListener("click", async () => {
  const text = document.getElementById("result-box").textContent;
  if (!text || document.getElementById("result-box").classList.contains("empty")) return;
  const ok = await copyText(text);
  const btn = document.getElementById("btn-copy");
  btn.textContent = ok ? "✅ コピーしました" : "❌ コピー失敗";
  setTimeout(() => btn.textContent = "📋 結果をコピー", 1500);
});

document.getElementById("btn-add").addEventListener("click", addEntry);

document.getElementById("add-en").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.metaKey) addEntry();
});

document.getElementById("filter-input").addEventListener("input", (e) => {
  renderList(e.target.value);
});

// JSONエクスポート
document.getElementById("btn-export").addEventListener("click", async () => {
  const dict = await loadDict();
  const json = JSON.stringify(dict, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "prompt_dict.json";
  a.click();
  URL.revokeObjectURL(url);
});

// テキストエクスポート（LLM読み込み用）
document.getElementById("btn-export-text").addEventListener("click", async () => {
  const dict = await loadDict();
  const nl = "\n";
  const lines = Object.entries(dict).map(([ja, en]) => ja + " → " + en).join(nl);
  const text = "# プロンプト変換辞書" + nl + "# 日本語キーワード → 英語プロンプト" + nl + nl + lines;
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "prompt_dict.txt";
  a.click();
  URL.revokeObjectURL(url);
});

// お気に入り／履歴JSONインポート（両形式対応）
document.getElementById("btn-import-json-fav").addEventListener("click", () => {
  document.getElementById("json-fav-file-input").click();
});

document.getElementById("json-fav-file-input").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  let data;
  try { data = JSON.parse(text); } catch (err) { alert("JSONの読み込みに失敗しました"); return; }
  if (!Array.isArray(data)) { alert("対応していない形式です"); return; }
  const dict = await loadDict();
  let count = 0;
  for (const item of data) {
    const ja = (item.name || "").trim();
    const en = (item.prompt || "").trim();
    if (ja && en) { dict[ja] = en; count++; }
    for (const tag of (item.tags || [])) {
      const tja = (tag.localValue || "").trim();
      const ten = (tag.value || "").trim();
      if (tja && ten && tja !== ten) { dict[tja] = ten; count++; }
    }
  }
  await saveDict(dict);
  await renderList(document.getElementById("filter-input").value);
  alert(count + "件のエントリをインポートしました！");
  e.target.value = "";
});


// YAMLインポート
document.getElementById("btn-import-yaml").addEventListener("click", () => {
  document.getElementById("yaml-file-input").click();
});

document.getElementById("yaml-file-input").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  const text = await file.text();
  const dict = await loadDict();
  let count = 0;
  
  // 簡易YAMLパーサー
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let inTags = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // "tags:" で始まったら処理開始
    if (line.trim() === "tags:") {
      inTags = true;
      continue;
    }
    
    // インデント8以上の行がタグ
    if (inTags && line.match(/^\s{8,}/)) {
      // "  英語: 日本語" の形式
      const match = line.match(/^\s+([^:]+):\s*(.+)$/);
      if (match) {
        const en = match[1].trim();
        const ja = match[2].trim();
        if (en && ja && en !== ja) {
          dict[ja] = en;
          count++;
        }
      }
    } else if (inTags && line.trim() && !line.match(/^\s{8,}/)) {
      // インデントが少なくなったら tags セクション終了
      if (!line.match(/^\s{2,8}/)) {
        inTags = false;
      }
    }
  }
  
  await saveDict(dict);
  await renderList(document.getElementById("filter-input").value);
  alert(count + "件のタグをインポートしました！");
  e.target.value = "";
});



// テキストペーストインポート
document.getElementById("btn-import-text").addEventListener("click", async () => {
  const text = prompt("要素\tタグの形式でペーストしてください：\n\n例：\n恥ずかしそう\tbright red cheeks, flushed face, embarrassed expression\nびっくりして\tsurprised expression, shocked expression");
  if (!text) return;
  
  const dict = await loadDict();
  let count = 0;
  let importedItems = [];
  
  const lines = text.trim().replace(/\r\n/g, "\n").split("\n");
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    // タブ区切り、またはスペースで分割
    const parts = line.split("\t");
    if (parts.length < 2) {
      // スペースで分割してみる
      const spaceParts = line.split(/\s{2,}/);
      if (spaceParts.length < 2) continue;
      
      const ja = spaceParts[0].trim();
      const en = spaceParts[1].trim();
      if (!ja || !en) continue;
      
      // カンマで分割してそれぞれ別の登録にする
      const enArray = en.split(',').map(e => e.trim()).filter(e => e);
      for (const enItem of enArray) {
        dict[ja] = enItem;
        importedItems.push({ ja, en: enItem });
        count++;
      }
    } else {
      const ja = parts[0].trim();
      const en = parts[1].trim();
      if (!ja || !en) continue;
      
      // カンマで分割してそれぞれ別の登録にする
      const enArray = en.split(',').map(e => e.trim()).filter(e => e);
      for (const enItem of enArray) {
        dict[ja] = enItem;
        importedItems.push({ ja, en: enItem });
        count++;
      }
    }
  }
  
  if (count === 0) {
    alert("エントリが見つかりません。形式を確認してください。");
    return;
  }
  
  await saveDict(dict);
  await renderList(document.getElementById("filter-input").value);
  
  // インポート結果をプレビュー
  let previewText = "✅ " + count + "件のエントリをインポートしました！\n\n";
  previewText += "---インポート内容---\n";
  previewText += importedItems.slice(0, 10).map(item => item.ja + " → " + item.en).join("\n");
  if (count > 10) previewText += "\n... 他 " + (count - 10) + "件";
  
  alert(previewText);
});

// フレーズ集CSVインポート
document.getElementById("btn-import-phrases").addEventListener("click", () => {
  document.getElementById("phrases-file-input").click();
});

document.getElementById("phrases-file-input").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  const text = await file.text();
  const dict = await loadDict();
  let count = 0;
  
  // CSVパース（簡易版）
  const lines = text.trim().replace(/\r\n/g, "\n").split("\n");
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    // カンマで分割（ダブルクォートでエスケープされている場合を考慮）
    let en = "";
    let jp = "";
    let inQuote = false;
    let field = "";
    let fields = [];
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuote && line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuote = !inQuote;
        }
      } else if (char === ',' && !inQuote) {
        fields.push(field);
        field = "";
      } else {
        field += char;
      }
    }
    fields.push(field);
    
    if (fields.length < 2) continue;
    
    en = fields[0].replace(/^"|"$/g, "").trim();
    jp = fields[1].replace(/^"|"$/g, "").trim();
    
    if (!en || !jp) continue;
    
    // 複数の日本語翻訳を分割して追加
    const translations = jp.split(',').map(t => t.trim()).filter(t => t);
    for (const trans of translations) {
      if (en && trans) {
        dict[trans] = en;
        count++;
      }
    }
  }
  
  await saveDict(dict);
  await renderList(document.getElementById("filter-input").value);
  alert(count + "件のフレーズをインポートしました！");
  e.target.value = "";
});

// タグサジェスト（dict画面用）
let allTags = [];
async function loadTags() {
  return new Promise(resolve => {
    chrome.storage.local.get("tag_suggestions", d => {
      allTags = d["tag_suggestions"] || [];
      resolve();
    });
  });
}

function initSuggest(inputId, suggestBoxId) {
  const input = document.getElementById(inputId);
  const box = document.getElementById(suggestBoxId);
  if (!input || !box) return;
  let activeIdx = -1;
  let suggestions = [];

  input.addEventListener("keydown", (e) => {
    if (box.style.display === "none") return;
    if (e.key === "ArrowDown") { e.preventDefault(); activeIdx = Math.min(activeIdx + 1, suggestions.length - 1); updateActive(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); activeIdx = Math.max(activeIdx - 1, -1); updateActive(); }
    else if (e.key === "Enter" || e.key === "Tab") { if (activeIdx >= 0) { e.preventDefault(); insertTag(suggestions[activeIdx]); } }
    else if (e.key === "Escape") { box.style.display = "none"; }
  });

  input.addEventListener("input", () => {
    const isTextarea = input.tagName === "TEXTAREA";
    let currentWord = "";
    if (isTextarea) {
      const beforeCursor = input.value.substring(0, input.selectionStart);
      const lastComma = Math.max(beforeCursor.lastIndexOf(","), beforeCursor.lastIndexOf("\n"));
      currentWord = beforeCursor.substring(lastComma + 1).trim();
    } else {
      currentWord = input.value.trim();
    }
    if (currentWord.length < 2) { box.style.display = "none"; return; }
    suggestions = allTags.filter(t => t.startsWith(currentWord)).slice(0, 10);
    if (!suggestions.length) { box.style.display = "none"; return; }
    activeIdx = -1;
    box.innerHTML = suggestions.map((t, i) => `<div class="suggest-item" data-idx="${i}">${t}</div>`).join("");
    box.style.display = "block";
    box.querySelectorAll(".suggest-item").forEach(item => {
      item.addEventListener("mousedown", (e) => { e.preventDefault(); insertTag(suggestions[parseInt(item.dataset.idx)]); });
    });
  });

  input.addEventListener("blur", () => { setTimeout(() => box.style.display = "none", 150); });

  function updateActive() {
    box.querySelectorAll(".suggest-item").forEach((el, i) => el.classList.toggle("active", i === activeIdx));
  }

  function insertTag(tag) {
    const isTextarea = input.tagName === "TEXTAREA";
    if (isTextarea) {
      const val = input.value;
      const cursorPos = input.selectionStart;
      const beforeCursor = val.substring(0, cursorPos);
      const lastComma = Math.max(beforeCursor.lastIndexOf(","), beforeCursor.lastIndexOf("\n"));
      const currentWord = beforeCursor.substring(lastComma + 1).trimStart();
      const start = lastComma + 1 + (beforeCursor.substring(lastComma + 1).length - currentWord.length);
      input.value = val.substring(0, start) + tag + val.substring(cursorPos);
      const newCursor = start + tag.length;
      input.setSelectionRange(newCursor, newCursor);
    } else {
      input.value = tag;
    }
    box.style.display = "none";
  }
}

loadTags().then(() => {
  initSuggest("add-en", "suggest-box-add-en");
});

// バックアップ
document.getElementById("btn-backup").addEventListener("click", async () => {
  const dict = await loadDict();
  const tags = await new Promise(resolve => {
    chrome.storage.local.get("tag_suggestions", d => resolve(d["tag_suggestions"] || []));
  });

  const now = new Date();
  const pad = n => String(n).padStart(2, "0");
  const dateStr = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  const backup = {
    version: "1.0",
    date: now.toISOString(),
    prompt_dict: dict,
    tag_suggestions: tags
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `comfyui_backup_${dateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// 復元
document.getElementById("btn-restore").addEventListener("click", () => {
  document.getElementById("restore-file-input").click();
});

document.getElementById("restore-file-input").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const text = await file.text();
  let backup;
  try { backup = JSON.parse(text); } catch (err) { alert("ファイルの読み込みに失敗しました"); return; }

  if (!backup.prompt_dict) { alert("バックアップファイルの形式が正しくありません"); return; }

  if (!confirm(`バックアップ日時: ${backup.date || "不明"}\n\n現在のデータを上書きして復元しますか？`)) return;

  await chrome.storage.local.set({ "prompt_dict": backup.prompt_dict });
  if (backup.tag_suggestions) {
    await chrome.storage.local.set({ "tag_suggestions": backup.tag_suggestions });
  }

  await renderList(document.getElementById("filter-input").value);
  alert("復元完了しました！");
  e.target.value = "";
});

// 拡張に同梱した辞書（dict_data.js）。ストレージが空のときだけ自動で流し込む。
// ＝拡張をリロード/アップデートしてストレージが飛んでも、同梱分は必ず復活する。
// （既にデータがある場合は触らないので、手動で消したエントリが復活したりはしない）
async function seedFromBundleIfEmpty() {
  try {
    if (typeof window.__BUNDLED_DICT__ === "undefined") return;
    const bundled = window.__BUNDLED_DICT__ || {};
    const bCount = Object.keys(bundled).length;
    if (bCount === 0) return;
    const cur = await loadDict();
    if (Object.keys(cur).length > 0) return; // 既にデータがあれば何もしない
    await new Promise(r => chrome.storage.local.set({ [STORAGE_KEY]: bundled }, r));
    if (window.__BUNDLED_TAGS__ && window.__BUNDLED_TAGS__.length) {
      const t = await new Promise(r => chrome.storage.local.get("tag_suggestions", d => r(d.tag_suggestions)));
      if (!t || !t.length) await new Promise(r => chrome.storage.local.set({ tag_suggestions: window.__BUNDLED_TAGS__ }, r));
    }
    console.log(`%c[辞書] 同梱データから ${bCount.toLocaleString()}件を自動復元`, "color:#a6e3a1;font-weight:bold");
    setAutosaveStatus(`✅ 同梱データから ${bCount.toLocaleString()}件を復元`, "#a6e3a1");
  } catch (e) { console.error("[辞書] 同梱データ復元に失敗:", e); }
}

// 初期描画
(async () => {
  await seedFromBundleIfEmpty();
  await renderList();
})();

// ===== AIバックエンド設定（Ollama / LM Studio 切り替え） =====
const LLM_DEFAULTS = {
  ollama:   { url: "http://127.0.0.1:11434", model: "mistral:latest" },
  lmstudio: { url: "http://127.0.0.1:1234",  model: "magnum-v4-12b-mlx" }
};

const backendEl = document.getElementById("llm-backend");
const urlEl = document.getElementById("llm-server-url");
const modelEl = document.getElementById("llm-model");

// 現在の設定をフィールドから取得
function getLlmConfig() {
  return {
    backend: backendEl.value || "lmstudio",
    serverUrl: urlEl.value.trim() || LLM_DEFAULTS[backendEl.value || "lmstudio"].url,
    model: modelEl.value.trim() || LLM_DEFAULTS[backendEl.value || "lmstudio"].model
  };
}

// 設定を保存
function saveLlmConfig() {
  chrome.storage.local.set({
    llm_backend: backendEl.value,
    llm_server_url: urlEl.value.trim(),
    llm_model: modelEl.value.trim()
  });
}

// 起動時：保存済み設定を反映
chrome.storage.local.get(["llm_backend", "llm_server_url", "llm_model"], (d) => {
  const backend = d.llm_backend || "lmstudio";
  backendEl.value = backend;
  urlEl.value = d.llm_server_url || LLM_DEFAULTS[backend].url;
  modelEl.value = d.llm_model || LLM_DEFAULTS[backend].model;
});

// バックエンド切り替え：URL/モデルが空 or 他バックエンドの既定値ならその既定値に差し替え
backendEl.addEventListener("change", () => {
  const backend = backendEl.value;
  const other = backend === "ollama" ? "lmstudio" : "ollama";
  if (!urlEl.value.trim() || urlEl.value.trim() === LLM_DEFAULTS[other].url) {
    urlEl.value = LLM_DEFAULTS[backend].url;
  }
  if (!modelEl.value.trim() || modelEl.value.trim() === LLM_DEFAULTS[other].model) {
    modelEl.value = LLM_DEFAULTS[backend].model;
  }
  saveLlmConfig();
});
urlEl.addEventListener("change", saveLlmConfig);
modelEl.addEventListener("change", saveLlmConfig);

// ===== ComfyUIサーバー接続先（画像生成・履歴の宛先） =====
const comfyBaseEl = document.getElementById("comfy-base-input");
if (comfyBaseEl) {
  // 保存済みの接続先を反映（config.js が読み込んだ値）
  comfyBaseReady.then(() => { comfyBaseEl.value = COMFYUI_BASE; });
  const saveComfyBase = () => {
    const v = comfyBaseEl.value.trim();
    if (!v) return;
    chrome.storage.local.set({ comfyui_base: v });
  };
  comfyBaseEl.addEventListener("change", saveComfyBase);
}

// AI推奨ボタン（dict.html）
document.getElementById("btn-ai-suggest-dict").addEventListener("click", async () => {
  const input = document.getElementById("search-input").value.trim();
  if (!input) {
    alert("日本語キーワードを入力してください");
    return;
  }

  const btn = document.getElementById("btn-ai-suggest-dict");
  btn.disabled = true;
  btn.textContent = "推奨中...";

  const cfg = getLlmConfig();
  chrome.runtime.sendMessage({
    type: "ollama-generate",
    backend: cfg.backend,
    serverUrl: cfg.serverUrl,
    model: cfg.model,
    temperature: 0.5,
    maxTokens: 1536,
    system: "You suggest image-generation prompt tags. Given the user's keyword, output exactly 5 relevant English tags (Danbooru/booru-style short phrases). Return ONLY the 5 tags as a single comma-separated line, with no numbering, notes, or explanations.",
    prompt: input
  }, (response) => {
    if (response && response.success && response.response) {
      // <think>除去
      let raw = response.response.replace(/<think>[\s\S]*?<\/think>/gi, "");
      if (/<\/think>/i.test(raw)) raw = raw.split(/<\/think>/i).pop();
      raw = raw.replace(/<\/?think>/gi, "").trim();
      const tags = raw.split(",").map(t => t.trim()).filter(t => t).slice(0, 5);
      const text = tags.join(", ");
      showResult(text);
      addHistory(input, text);
    } else {
      alert("タグ推奨に失敗しました。\n" + (response?.error || "サーバーが起動していますか?"));
    }
    btn.disabled = false;
    btn.textContent = "🤖 AI推奨";
  });
});


// 接続確認（dict.html）
document.getElementById("btn-llm-test").addEventListener("click", () => {
  const cfg = getLlmConfig();
  const btn = document.getElementById("btn-llm-test");
  const status = document.getElementById("llm-status");

  btn.disabled = true;
  btn.textContent = "確認中...";

  chrome.runtime.sendMessage({
    type: "ollama-test",
    backend: cfg.backend,
    serverUrl: cfg.serverUrl
  }, (response) => {
    if (response && response.success) {
      status.textContent = `✅ 接続OK (${cfg.backend})`;
      status.style.color = "#a6e3a1";
    } else {
      status.textContent = "❌ 接続失敗";
      status.style.color = "#f38ba8";
    }
    btn.disabled = false;
    btn.textContent = "確認";
  });
});



// クリップボードコピー（フォールバック付き／結果ボックス用）
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (e2) {
      return false;
    }
  }
}
