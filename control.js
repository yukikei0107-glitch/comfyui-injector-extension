const COMFYUI_BASE = "http://100.64.162.109:8188";

// CORSを避けるためbackground.js経由でfetch
function bgFetch(url, method = "GET", body = null) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "FETCH", url, method, body: body ? JSON.stringify(body) : null },
      (res) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else if (res.ok) resolve(res.data);
        else reject(new Error(res.error));
      }
    );
  });
}

const statusEl = document.getElementById("status");
const promptInput = document.getElementById("prompt-input");
const btnPaste = document.getElementById("btn-paste");
const btnInject = document.getElementById("btn-inject");
const btnGenerate = document.getElementById("btn-generate");
const spinner = document.getElementById("spinner");
const placeholder = document.getElementById("placeholder");
const resultImage = document.getElementById("result-image");

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.className = "status" + (isError ? " error" : "");
}

async function getComfyTab() {
  return new Promise(resolve =>
    chrome.tabs.query({ url: `${COMFYUI_BASE}/*` }, tabs => resolve(tabs?.[0] || null))
  );
}

async function injectPrompt(text) {
  const tab = await getComfyTab();
  if (!tab) { setStatus("ComfyUI タブが見つかりません", true); return false; }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: "MAIN",
    func: (newText) => {
      const POSITIVE_KEYWORDS = ["positive", "ポジティブ"];
      const NEGATIVE_KEYWORDS = ["negative", "ネガティブ", "neg"];
      const nodes = window.app?.graph?._nodes || [];
      let targetNode = null, fallbackNode = null;
      for (const node of nodes) {
        const title = (node.title || "").toLowerCase();
        const type = (node.type || "").toLowerCase();
        const isText = type === "cliptextencode" || type === "primitivestringmultiline";
        const isNeg = NEGATIVE_KEYWORDS.some(k => title.includes(k));
        const isPos = POSITIVE_KEYWORDS.some(k => title.includes(k));
        if (isText && isPos) { targetNode = node; break; }
        if (isText && !isNeg && !fallbackNode) fallbackNode = node;
      }
      const node = targetNode || fallbackNode;
      if (!node) return { error: "ノードが見つかりません" };
      const widget = (node.widgets || []).find(w => w.name === "value" || w.name === "text" || w.type === "customtext");
      if (!widget) return { error: "ウィジェットが見つかりません" };
      widget.value = newText.trim();
      if (node.setDirtyCanvas) node.setDirtyCanvas(true, true);
      if (window.app?.graph?.setDirtyCanvas) window.app.graph.setDirtyCanvas(true, true);
      return { success: true };
    },
    args: [text]
  });

  const result = results?.[0]?.result;
  if (result?.success) { setStatus("ノードに反映しました！"); return true; }
  setStatus(result?.error || "失敗しました", true);
  return false;
}

async function generateImage() {
  const text = promptInput.value.trim();
  if (!text) { setStatus("プロンプトを入力してください", true); return; }

  // 生成前にノードに反映
  await injectPrompt(text);

  setStatus("ワークフロー取得中...");
  spinner.style.display = "block";
  placeholder.style.display = "none";
  resultImage.style.display = "none";
  btnGenerate.disabled = true;

  try {
    const history = await bgFetch(`${COMFYUI_BASE}/history`);
    const keys = Object.keys(history);
    if (!keys.length) { setStatus("ワークフロー履歴がありません。一度手動で実行してください", true); return; }

    const workflow = history[keys[keys.length - 1]].prompt[2];

    // ポジティブプロンプトを差し替え
    for (const [id, node] of Object.entries(workflow)) {
      const title = (node._meta?.title || "").toLowerCase();
      const type = (node.class_type || "").toLowerCase();
      const isText = type === "cliptextencode" || type === "primitivestringmultiline";
      const isPos = ["positive", "ポジティブ"].some(k => title.includes(k));
      if (isText && isPos) {
        if ("value" in node.inputs) node.inputs.value = text;
        else node.inputs.text = text;
        break;
      }
    }

    // SaveImageのファイル名プレフィックスの日時を現在時刻に更新
    // 例: "2026-06-02/20260602_181533_anima" → 日付フォルダとファイル名の両方を更新
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const y = now.getFullYear(), mo = pad(now.getMonth() + 1), da = pad(now.getDate());
    const dateFolder = `${y}-${mo}-${da}`;                                              // 2026-06-03
    const dateTime = `${y}${mo}${da}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`; // 20260603_120000
    for (const [id, node] of Object.entries(workflow)) {
      if (node.class_type === "SaveImage") {
        let prefix = node.inputs.filename_prefix || "";
        prefix = prefix.replace(/\d{4}-\d{2}-\d{2}/, dateFolder); // 日付フォルダ（yyyy-MM-dd）
        prefix = prefix.replace(/\d{8}_\d{6}/, dateTime);         // ファイル名の日時（yyyyMMdd_hhmmss）
        node.inputs.filename_prefix = prefix;
      }
    }

    // seedをランダムに
    const newSeed = Math.floor(Math.random() * 2**32);
    for (const [id, node] of Object.entries(workflow)) {
      const type = (node.class_type || "").toLowerCase();
      if (type === "ksampler" || type === "ksampleradvanced") {
        if ("seed" in node.inputs) node.inputs.seed = newSeed;
      }
    }

    // エディタ上のseedも更新
    const tab = await getComfyTab();
    if (tab) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        func: (seed) => {
          const nodes = window.app?.graph?._nodes || [];
          for (const node of nodes) {
            const type = (node.type || "").toLowerCase();
            if (type === "ksampler" || type === "ksampleradvanced") {
              const widget = (node.widgets || []).find(w => w.name === "seed");
              if (widget) widget.value = seed;
              if (node.setDirtyCanvas) node.setDirtyCanvas(true, true);
            }
          }
        },
        args: [newSeed]
      });
    }

    setStatus("生成中...");
    const queueData = await bgFetch(`${COMFYUI_BASE}/prompt`, "POST", { prompt: workflow, client_id: "comfyui_ext" });
    const promptId = queueData.prompt_id;
    if (!promptId) { setStatus("キューへの送信に失敗しました", true); return; }

    await pollForResult(promptId);
  } catch (e) {
    setStatus("エラー: " + e.message, true);
  } finally {
    spinner.style.display = "none";
    btnGenerate.disabled = false;
  }
}

async function pollForResult(promptId) {
  for (let i = 0; i < 120; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const data = await bgFetch(`${COMFYUI_BASE}/history/${promptId}`);
    const entry = data[promptId];
    if (!entry) continue;
    for (const nodeOut of Object.values(entry.outputs)) {
      if (nodeOut.images?.length > 0) {
        const img = nodeOut.images[0];
        const imgUrl = `${COMFYUI_BASE}/api/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || "")}&type=${img.type}`;
        resultImage.src = imgUrl;
        resultImage.style.display = "block";
        placeholder.style.display = "none";
        setStatus("生成完了！");
        return;
      }
    }
  }
  setStatus("タイムアウト：生成に時間がかかっています", true);
}

async function loadCurrentPrompt() {
  const tab = await getComfyTab();
  if (!tab) return;
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: "MAIN",
    func: () => {
      const POSITIVE_KEYWORDS = ["positive", "ポジティブ"];
      const nodes = window.app?.graph?._nodes || [];
      for (const node of nodes) {
        const title = (node.title || "").toLowerCase();
        const type = (node.type || "").toLowerCase();
        const isText = type === "cliptextencode" || type === "primitivestringmultiline";
        const isPos = POSITIVE_KEYWORDS.some(k => title.includes(k));
        if (isText && isPos) {
          const widget = (node.widgets || []).find(w => w.name === "value" || w.name === "text" || w.type === "customtext");
          return widget?.value || "";
        }
      }
      return "";
    }
  });
  const text = results?.[0]?.result;
  if (text) promptInput.value = text;
}

btnPaste.addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      const current = promptInput.value;
      const separator = current.trim() ? ", " : "";
      promptInput.value = current + separator + text;
    }
  } catch (e) {
    setStatus("クリップボードの読み取りに失敗しました", true);
  }
});

btnInject.addEventListener("click", async () => {
  const text = promptInput.value.trim();
  if (!text) { setStatus("プロンプトを入力してください", true); return; }
  await injectPrompt(text);
});

btnGenerate.addEventListener("click", generateImage);

// タグサジェスト
let allTags = [];
async function loadTags() {
  return new Promise(resolve => {
    chrome.storage.local.get("tag_suggestions", d => {
      allTags = d["tag_suggestions"] || [];
      resolve();
    });
  });
}

function initSuggest(textareaId, suggestBoxId) {
  const textarea = document.getElementById(textareaId);
  const box = document.getElementById(suggestBoxId);
  let activeIdx = -1;
  let suggestions = [];

  textarea.addEventListener("keydown", (e) => {
    if (box.style.display === "none") return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIdx = Math.min(activeIdx + 1, suggestions.length - 1);
      updateActive();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIdx = Math.max(activeIdx - 1, -1);
      updateActive();
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (activeIdx >= 0) {
        e.preventDefault();
        insertTag(suggestions[activeIdx]);
      }
    } else if (e.key === "Escape") {
      box.style.display = "none";
    }
  });

  textarea.addEventListener("input", () => {
    const val = textarea.value;
    const cursorPos = textarea.selectionStart;
    // カーソル前の最後の区切り文字（カンマ・改行・スペース）以降の単語を取得
    const beforeCursor = val.substring(0, cursorPos);
    const lastSep = Math.max(
      beforeCursor.lastIndexOf(","),
      beforeCursor.lastIndexOf("\n"),
      beforeCursor.lastIndexOf(" "),
      beforeCursor.lastIndexOf("("),
      beforeCursor.lastIndexOf(")")
    );
    const currentWord = beforeCursor.substring(lastSep + 1).trim();

    if (currentWord.length < 2) { box.style.display = "none"; return; }

    suggestions = allTags.filter(t => t.startsWith(currentWord)).slice(0, 10);
    if (!suggestions.length) { box.style.display = "none"; return; }

    activeIdx = -1;
    box.innerHTML = suggestions.map((t, i) => `<div class="suggest-item" data-idx="${i}">${t}</div>`).join("");
    box.style.display = "block";

    box.querySelectorAll(".suggest-item").forEach(item => {
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        insertTag(suggestions[parseInt(item.dataset.idx)]);
      });
    });
  });

  textarea.addEventListener("blur", () => {
    setTimeout(() => box.style.display = "none", 150);
  });

  function updateActive() {
    box.querySelectorAll(".suggest-item").forEach((el, i) => {
      el.classList.toggle("active", i === activeIdx);
    });
  }

  function insertTag(tag) {
    const val = textarea.value;
    const cursorPos = textarea.selectionStart;
    const beforeCursor = val.substring(0, cursorPos);
    const lastSep = Math.max(
      beforeCursor.lastIndexOf(","),
      beforeCursor.lastIndexOf("\n"),
      beforeCursor.lastIndexOf(" "),
      beforeCursor.lastIndexOf("("),
      beforeCursor.lastIndexOf(")")
    );
    const currentWord = beforeCursor.substring(lastSep + 1).trimStart();
    const start = lastSep + 1 + (beforeCursor.substring(lastSep + 1).length - currentWord.length);
    const newVal = val.substring(0, start) + tag + val.substring(cursorPos);
    textarea.value = newVal;
    const newCursor = start + tag.length;
    textarea.setSelectionRange(newCursor, newCursor);
    box.style.display = "none";
  }
}

// 履歴画面からプロンプトと画像を受け取る
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "SET_PROMPT") {
    document.getElementById("prompt-input").value = msg.text;
    if (msg.imageUrl) {
      const img = document.getElementById("result-image");
      img.src = msg.imageUrl;
      img.style.display = "block";
      document.getElementById("placeholder").style.display = "none";
    }
  }
});

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(loadCurrentPrompt, 800);
  initDictPanel();
  loadTags().then(() => initSuggest("prompt-input", "suggest-box"));
});

// 辞書パネル
async function loadDictData() {
  return new Promise(resolve => {
    chrome.storage.local.get("prompt_dict", data => resolve(data["prompt_dict"] || {}));
  });
}

// 辞書パネルの現在の変換結果（AI推奨ハンドラなど外側からも参照するためモジュールスコープに置く）
let currentResult = "";

function initDictPanel() {
  const panel = document.getElementById("dict-panel");
  const btnDict = document.getElementById("btn-dict");
  const searchEl = document.getElementById("dict-search");
  const resultEl = document.getElementById("dict-result");
  const btnAppend = document.getElementById("btn-dict-append");
  const listEl = document.getElementById("dict-list");

  // クリアボタン
  document.getElementById("btn-dict-clear").addEventListener("click", () => {
    searchEl.value = "";
    currentResult = "";
    resultEl.textContent = "キーワードを入力してください";
    resultEl.className = "dict-result empty";
    renderDictList("");
    searchEl.focus();
  });

  // 開閉トグル
  btnDict.addEventListener("click", async () => {
    panel.classList.toggle("open");
    if (panel.classList.contains("open")) {
      await renderDictList("");
      searchEl.focus();
    }
  });

  // 検索（完全一致 → 日本語キー部分一致 → 英語の値部分一致）
  searchEl.addEventListener("input", async (e) => {
    const val = e.target.value.trim();
    const q = val.toLowerCase();
    const dict = await loadDictData();
    let key = !val ? null : (dict[val] ? val
      : Object.keys(dict).find(k => k.includes(val))
      || Object.keys(dict).find(k => dict[k].toLowerCase().includes(q)));
    if (key) {
      currentResult = dict[key];
      resultEl.textContent = currentResult;
      resultEl.className = "dict-result";
    } else {
      currentResult = "";
      resultEl.textContent = val ? `「${val}」は辞書にありません` : "キーワードを入力してください";
      resultEl.className = "dict-result empty";
    }
    await renderDictList(val);
  });

  // プロンプトに追記
  btnAppend.addEventListener("click", () => {
    if (!currentResult) return;
    const textarea = document.getElementById("prompt-input");
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);
    const separator = (before.trim() && !before.endsWith(", ")) ? ", " : "";
    
    textarea.value = before + separator + currentResult + after;
    textarea.selectionStart = textarea.selectionEnd = start + separator.length + currentResult.length;
    textarea.focus();
    setStatus("プロンプトに追記しました!");
  });

  // コピーボタン
  document.getElementById("btn-dict-copy").addEventListener("click", async () => {
    if (!currentResult) return;
    try {
      await navigator.clipboard.writeText(currentResult);
      const btn = document.getElementById("btn-dict-copy");
      btn.textContent = "✅ コピー済み";
      setTimeout(() => btn.textContent = "📋 コピー", 1500);
    } catch (err) {
      console.error("コピー失敗:", err);
      alert("コピーに失敗しました");
    }
  });

  async function renderDictList(filter) {
    const dict = await loadDictData();
    const q = (filter || "").toLowerCase();
    const keys = Object.keys(dict).filter(k =>
      !filter || k.includes(filter) || dict[k].toLowerCase().includes(q)
    );
    if (!keys.length) {
      listEl.innerHTML = '<div style="color:#45475a;font-size:11px;padding:8px;">エントリがありません</div>';
      return;
    }
    listEl.innerHTML = keys.map(ja => `
      <div class="dict-item" data-ja="${ja}" data-en="${dict[ja]}">
        <div class="di-ja">${ja}</div>
        <div class="di-en">${dict[ja]}</div>
      </div>
    `).join("");

    listEl.querySelectorAll(".dict-item").forEach(item => {
      item.addEventListener("click", () => {
        currentResult = item.dataset.en;
        resultEl.textContent = currentResult;
        resultEl.className = "dict-result";
        searchEl.value = item.dataset.ja;
      });
    });
  }
}







// 辞書/設定タブ切り替え
document.getElementById("tab-dict").addEventListener("click", () => {
  document.getElementById("dict-section").style.display = "flex";
  document.getElementById("settings-section").style.display = "none";
  document.getElementById("tab-dict").style.background = "#89b4fa";
  document.getElementById("tab-dict").style.color = "#1e1e2e";
  document.getElementById("tab-settings").style.background = "#45475a";
  document.getElementById("tab-settings").style.color = "#cdd6f4";
});

document.getElementById("tab-settings").addEventListener("click", () => {
  document.getElementById("dict-section").style.display = "none";
  document.getElementById("settings-section").style.display = "block";
  document.getElementById("tab-dict").style.background = "#45475a";
  document.getElementById("tab-dict").style.color = "#cdd6f4";
  document.getElementById("tab-settings").style.background = "#89b4fa";
  document.getElementById("tab-settings").style.color = "#1e1e2e";
});

// LLM設定
let llmServerUrl = "http://localhost:12345";
chrome.storage.local.get("llm_server_url", (data) => {
  if (data.llm_server_url) {
    llmServerUrl = data.llm_server_url;
    document.getElementById("llm-server-url").value = llmServerUrl;
  }
});

// 翻訳機能
document.getElementById("btn-translate").addEventListener("click", async () => {
  const input = document.getElementById("translate-input").value.trim();
  if (!input) {
    alert("日本語を入力してください");
    return;
  }

  const btn = document.getElementById("btn-translate");
  btn.disabled = true;
  btn.textContent = "翻訳中...";

  chrome.runtime.sendMessage({
    type: "ollama-generate",
    serverUrl: llmServerUrl,
    model: "mistral",
    prompt: `You are a professional translator. Translate the following Japanese into natural, fluent English written as complete, grammatical sentences (prose). Do NOT output a list of comma-separated tags or keywords — write it the way a human would write a normal sentence or paragraph. Preserve the original meaning and tone. Output only the English translation, with no notes, labels, or explanations.\n\nJapanese: ${input}`
  }, (response) => {
    if (response && response.success) {
      document.getElementById("translate-output").value = response.response.trim();
    } else {
      alert("翻訳に失敗しました");
    }
    btn.disabled = false;
    btn.textContent = "翻訳";
  });
});

// 翻訳結果をプロンプトに記入
document.getElementById("btn-translate-insert").addEventListener("click", () => {
  const text = document.getElementById("translate-output").value.trim();
  if (!text) {
    alert("翻訳結果がありません");
    return;
  }

  const textarea = document.getElementById("prompt-input");
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const before = textarea.value.substring(0, start);
  const after = textarea.value.substring(end);
  
  textarea.value = before + text + after;
  textarea.selectionStart = textarea.selectionEnd = start + text.length;
  textarea.focus();
});



// AI推奨タグボタン
document.getElementById("btn-ai-suggest").addEventListener("click", () => {
  const promptInput = document.getElementById("prompt-input").value.trim();
  if (!promptInput) {
    alert("プロンプトを入力してください");
    return;
  }
  
  const btn = document.getElementById("btn-ai-suggest");
  btn.disabled = true;
  btn.textContent = "推奨中...";
  
  chrome.runtime.sendMessage({
    type: "ollama-generate",
    serverUrl: llmServerUrl,
    model: "mistral",
    prompt: `このプロンプトに関連する5個の英語タグを提案してください。カンマ区切りで返してください。\n\nプロンプト: ${promptInput}`
  }, (response) => {
    if (response && response.success) {
      if (!response.response) {
        alert("タグ推奨に失敗しました。Ollamaが起動していますか?");
        btn.disabled = false;
        btn.textContent = "🤖 AI推奨";
        return;
      }
      const tags = response.response.trim().split(",").map(t => t.trim()).filter(t => t).slice(0, 5);
      const resultText = tags.join(", ");
      currentResult = resultText;
      document.getElementById("dict-result").textContent = resultText;
      document.getElementById("dict-result").className = "dict-result";
    } else {
      alert("タグ推奨に失敗しました。Ollamaが起動していますか？");
    }
    btn.disabled = false;
    btn.textContent = "🤖 AI推奨";
  });
});


// ===== 画像ドラッグ＆ドロップ → プロンプト読み込み =====

// PNGのtEXt/iTXtチャンクからメタデータを取り出す
function parsePngTextChunks(arrayBuffer) {
  const data = new Uint8Array(arrayBuffer);
  // PNGシグネチャ確認
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (data[i] !== sig[i]) return null; // PNGではない
  }
  const result = {};
  let offset = 8;
  const view = new DataView(arrayBuffer);
  const decoder = new TextDecoder("utf-8");

  while (offset < data.length) {
    const length = view.getUint32(offset);
    const type = decoder.decode(data.subarray(offset + 4, offset + 8));
    const chunkStart = offset + 8;
    const chunkData = data.subarray(chunkStart, chunkStart + length);

    if (type === "tEXt") {
      // keyword \0 text
      const nul = chunkData.indexOf(0);
      if (nul !== -1) {
        const keyword = decoder.decode(chunkData.subarray(0, nul));
        const text = decoder.decode(chunkData.subarray(nul + 1));
        result[keyword] = text;
      }
    } else if (type === "iTXt") {
      // keyword \0 compFlag compMethod langTag \0 translatedKeyword \0 text
      const nul1 = chunkData.indexOf(0);
      if (nul1 !== -1) {
        const keyword = decoder.decode(chunkData.subarray(0, nul1));
        // 圧縮フラグ(1)・圧縮方式(1)をスキップ
        let p = nul1 + 3;
        const nul2 = chunkData.indexOf(0, p); // langTag終端
        const nul3 = nul2 !== -1 ? chunkData.indexOf(0, nul2 + 1) : -1; // translatedKeyword終端
        if (nul3 !== -1) {
          const text = decoder.decode(chunkData.subarray(nul3 + 1));
          result[keyword] = text;
        }
      }
    } else if (type === "IEND") {
      break;
    }

    offset = chunkStart + length + 4; // データ + CRC(4)
  }
  return result;
}

// メタデータのprompt JSONからポジティブプロンプトを抽出
function extractPositiveFromPrompt(promptObj) {
  for (const node of Object.values(promptObj)) {
    const title = (node._meta?.title || "").toLowerCase();
    const type = (node.class_type || "").toLowerCase();
    const isPos = ["positive", "ポジティブ"].some(k => title.includes(k));
    if ((type === "cliptextencode" || type === "primitivestringmultiline") && isPos) {
      return node.inputs?.value || node.inputs?.text || "";
    }
  }
  // posが見つからない場合：negを除く最初のテキストノード
  for (const node of Object.values(promptObj)) {
    const title = (node._meta?.title || "").toLowerCase();
    const type = (node.class_type || "").toLowerCase();
    const isNeg = ["negative", "ネガティブ", "neg"].some(k => title.includes(k));
    if ((type === "cliptextencode" || type === "primitivestringmultiline") && !isNeg) {
      return node.inputs?.value || node.inputs?.text || "";
    }
  }
  return "";
}

async function handleDroppedImage(file) {
  // 画像を表示
  const url = URL.createObjectURL(file);
  resultImage.src = url;
  resultImage.style.display = "block";
  placeholder.style.display = "none";
  spinner.style.display = "none";

  // PNGメタデータ解析
  if (!/\.png$/i.test(file.name) && file.type !== "image/png") {
    setStatus("画像を表示しました（PNG以外はプロンプト情報を取得できません）");
    return;
  }

  try {
    const buf = await file.arrayBuffer();
    const chunks = parsePngTextChunks(buf);
    if (!chunks) { setStatus("画像を表示しました（PNG解析に失敗）", true); return; }

    let promptObj = null;
    if (chunks.prompt) {
      try { promptObj = JSON.parse(chunks.prompt); } catch (e) {}
    }
    if (!promptObj && chunks.workflow) {
      // workflowからは抽出が複雑なため、promptが無い場合のみ通知
    }

    if (promptObj) {
      const text = extractPositiveFromPrompt(promptObj);
      if (text) {
        promptInput.value = text;
        setStatus("画像とプロンプトを読み込みました！");
      } else {
        setStatus("画像を表示しました（プロンプトが見つかりませんでした）");
      }
    } else {
      setStatus("画像を表示しました（メタデータが見つかりませんでした）");
    }
  } catch (e) {
    setStatus("画像を表示しました（解析エラー: " + e.message + "）", true);
  }
}

(function initDropZone() {
  const dropZone = document.getElementById("image-area");
  if (!dropZone) return;

  ["dragenter", "dragover"].forEach(evt =>
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.style.outline = "2px dashed #89b4fa";
      dropZone.style.outlineOffset = "-4px";
    })
  );

  ["dragleave", "drop"].forEach(evt =>
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.style.outline = "";
    })
  );

  dropZone.addEventListener("drop", async (e) => {
    const dt = e.dataTransfer;
    // ファイルドロップ
    if (dt.files && dt.files.length > 0) {
      const file = [...dt.files].find(f => f.type.startsWith("image/")) || dt.files[0];
      await handleDroppedImage(file);
      return;
    }
    // URL（他タブの画像など）ドロップ
    const url = dt.getData("text/uri-list") || dt.getData("text/plain");
    if (url) {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const fname = url.split("/").pop().split("?")[0] || "image.png";
        await handleDroppedImage(new File([blob], fname, { type: blob.type }));
      } catch (err) {
        setStatus("画像の取得に失敗しました: " + err.message, true);
      }
    }
  });
})();
