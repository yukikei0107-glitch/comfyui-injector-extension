const STORAGE_KEY = "prompt_dict";

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

// データ保存
async function saveDict(dict) {
  return new Promise(resolve => {
    chrome.storage.local.set({ [STORAGE_KEY]: dict }, () => {
      // 自動保存先が設定されていれば実ファイルにも上書き（best-effort）
      autoSaveToFile(dict);
      resolve();
    });
  });
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
  try {
    let perm = await autoSaveHandle.queryPermission({ mode: "readwrite" });
    if (perm !== "granted") {
      // ユーザー操作（クリック等）の流れの中なら許可を要求できる
      perm = await autoSaveHandle.requestPermission({ mode: "readwrite" });
      if (perm !== "granted") { setAutosaveStatus("⚠️ 書き込み権限がありません（保存先を再設定してください）", "#f9e2af"); return; }
    }
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
    setAutosaveStatus(`設定完了：${handle.name}（以後、追加・編集で自動上書き）`, "#a6e3a1");
    // 設定直後に現在の辞書を書き出しておく
    await autoSaveToFile(await loadDict());
  } catch (e) {
    if (e.name !== "AbortError") alert("保存先の設定に失敗しました: " + e.message);
  }
}

// 起動時：保存済みの handle を復元
(async () => {
  try {
    const h = await idbGet("handle");
    if (h) {
      autoSaveHandle = h;
      const perm = await h.queryPermission({ mode: "readwrite" });
      if (perm === "granted") setAutosaveStatus(`✅ 自動保存ON：${h.name}`, "#a6e3a1");
      else setAutosaveStatus(`🔒 自動保存：${h.name}（最初の追加時に権限確認が出ます）`, "#f9e2af");
    }
  } catch (e) {}
})();

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

// 追加
async function addEntry() {
  const ja = document.getElementById("add-ja").value.trim();
  const en = document.getElementById("add-en").value.trim();
  if (!ja || !en) { alert("日本語と英語の両方を入力してください"); return; }

  const dict = await loadDict();
  dict[ja] = en;
  await saveDict(dict);

  document.getElementById("add-ja").value = "";
  document.getElementById("add-en").value = "";
  await renderList(document.getElementById("filter-input").value);
  toast(autoSaveHandle ? `✅ 保存しました（ファイルにも書き込み）` : `✅ 保存しました`);
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

// 初期描画
(async () => {
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
    backend: backendEl.value || "ollama",
    serverUrl: urlEl.value.trim() || LLM_DEFAULTS[backendEl.value || "ollama"].url,
    model: modelEl.value.trim() || LLM_DEFAULTS[backendEl.value || "ollama"].model
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
  const backend = d.llm_backend || "ollama";
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



const COMFYUI_BASE = "http://100.64.162.109:8188";

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
