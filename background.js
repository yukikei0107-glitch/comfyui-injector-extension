const COMFYUI_BASE = "http://100.64.162.109:8188";

// control.html からのfetchリクエストをプロキシ
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== "FETCH") return;
  const options = { method: msg.method || "GET", headers: { "Content-Type": "application/json" } };
  if (msg.body) options.body = msg.body;
  fetch(msg.url, options)
    .then(r => r.json())
    .then(data => sendResponse({ ok: true, data }))
    .catch(e => sendResponse({ ok: false, error: e.message }));
  return true; // 非同期レスポンス
});

// アイコンクリックですべての画面を開く
chrome.action.onClicked.addListener(() => {
  openAllTabs();
});

// 最後にアクティブだったコントロール画面のタブIDを記憶（並行作業の送り先用）
let lastControlTabId = null;

function isControlUrl(url) {
  return !!url && url.startsWith(chrome.runtime.getURL("control.html"));
}

// タブがアクティブになったら、それがコントロール画面なら記憶
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (isControlUrl(tab.url)) lastControlTabId = tabId;
  } catch (e) {}
});

// 閉じられたタブが記憶対象ならリセット
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === lastControlTabId) lastControlTabId = null;
});

// 指定ページのタブを開く（既存があればフォーカス）。focus=falseならアクティブ化しない
async function openExtTab(page, focus = true) {
  const url = chrome.runtime.getURL(page);
  const tabs = await chrome.tabs.query({ url });
  if (tabs.length > 0) {
    if (focus) {
      chrome.tabs.update(tabs[0].id, { active: true });
      chrome.windows.update(tabs[0].windowId, { focused: true });
    }
    return tabs[0];
  }
  return await chrome.tabs.create({ url, active: focus });
}

// 辞書タブを開く関数
async function openDictTab() {
  return openExtTab("dict.html");
}

// 新しいコントロール画面を必ず新規ウィンドウで開く（並行作業用）
async function openNewControlTab() {
  const win = await chrome.windows.create({
    url: chrome.runtime.getURL("control.html"),
    type: "popup",
    width: 1400,
    height: 950
  });
  const tab = win.tabs?.[0];
  if (tab) lastControlTabId = tab.id;
  return tab;
}

// 履歴などからプロンプトを「最後に見ていたコントロール画面」へ送る
async function sendToControl(text, imageUrl) {
  const controlUrl = chrome.runtime.getURL("control.html");
  let targetId = lastControlTabId;

  // 記憶中のタブがまだ有効なコントロール画面か確認
  if (targetId != null) {
    try {
      const t = await chrome.tabs.get(targetId);
      if (!isControlUrl(t.url)) targetId = null;
    } catch (e) { targetId = null; }
  }

  // 無ければ：アクティブなコントロール画面 → 最初のコントロール画面
  if (targetId == null) {
    const tabs = await chrome.tabs.query({ url: controlUrl });
    if (tabs.length) targetId = (tabs.find(t => t.active) || tabs[0]).id;
  }

  // それも無ければ新規作成して読み込み後に送信
  if (targetId == null) {
    const tab = await chrome.tabs.create({ url: controlUrl, active: true });
    lastControlTabId = tab.id;
    setTimeout(() => {
      chrome.tabs.sendMessage(tab.id, { type: "SET_PROMPT", text, imageUrl });
    }, 1000);
    return;
  }

  chrome.tabs.sendMessage(targetId, { type: "SET_PROMPT", text, imageUrl });
  chrome.tabs.update(targetId, { active: true });
  lastControlTabId = targetId;
}

// 履歴画面からの送信リクエスト
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== "USE_IN_CONTROL") return;
  sendToControl(msg.text, msg.imageUrl).then(() => sendResponse({ ok: true }));
  return true;
});

// すべての画面を一度に開く
async function openAllTabs() {
  const pages = ["control.html", "dict.html", "history.html", "phrase_search.html"];
  for (const page of pages) {
    // 最後のcontrol.htmlだけアクティブにする
    await openExtTab(page, false);
  }
  // 最初に開いたcontrol.htmlをアクティブに
  await openExtTab("control.html", true);
}

// 右クリックメニュー
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "inject-prompt",
    title: "ComfyUI プロンプトに追加",
    contexts: ["selection"]
  });
  chrome.contextMenus.create({
    id: "open-all",
    title: "🚀 すべての画面を開く",
    contexts: ["all"]
  });
  chrome.contextMenus.create({
    id: "open-control",
    title: "ComfyUI コントロールを開く",
    contexts: ["all"]
  });
  chrome.contextMenus.create({
    id: "open-new-control",
    title: "➕ 新しいコントロールを開く（並行作業）",
    contexts: ["all"]
  });
  chrome.contextMenus.create({
    id: "open-dict",
    title: "プロンプト辞書を開く",
    contexts: ["all"]
  });
  chrome.contextMenus.create({
    id: "open-history",
    title: "生成履歴を開く",
    contexts: ["all"]
  });
  chrome.contextMenus.create({
    id: "open-phrase-search",
    title: "🔍 外部フレーズ検索を開く",
    contexts: ["all"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === "open-all") { openAllTabs(); return; }
  if (info.menuItemId === "open-new-control") { openNewControlTab(); return; }
  if (info.menuItemId === "open-dict") { openDictTab(); return; }
  if (info.menuItemId === "open-phrase-search") {
    const tabs = await chrome.tabs.query({ url: chrome.runtime.getURL("phrase_search.html") });
    if (tabs.length > 0) {
      chrome.tabs.update(tabs[0].id, { active: true });
      chrome.windows.update(tabs[0].windowId, { focused: true });
    } else {
      chrome.tabs.create({ url: chrome.runtime.getURL("phrase_search.html") });
    }
    return;
  }
  if (info.menuItemId === "open-history") {
    const tabs = await chrome.tabs.query({ url: chrome.runtime.getURL("history.html") });
    if (tabs.length > 0) {
      chrome.tabs.update(tabs[0].id, { active: true });
      chrome.windows.update(tabs[0].windowId, { focused: true });
    } else {
      chrome.tabs.create({ url: chrome.runtime.getURL("history.html") });
    }
    return;
  }
  if (info.menuItemId === "open-control") {
    const tabs = await chrome.tabs.query({ url: chrome.runtime.getURL("control.html") });
    if (tabs.length > 0) {
      chrome.tabs.update(tabs[0].id, { active: true });
      chrome.windows.update(tabs[0].windowId, { focused: true });
    } else {
      chrome.tabs.create({ url: chrome.runtime.getURL("control.html") });
    }
    return;
  }
  if (info.menuItemId !== "inject-prompt") return;
  const selectedText = info.selectionText;
  if (!selectedText?.trim()) return;

  const tabs = await chrome.tabs.query({ url: `${COMFYUI_BASE}/*` });
  if (!tabs?.length) return;

  await chrome.scripting.executeScript({
    target: { tabId: tabs[0].id },
    world: "MAIN",
    func: (appendText) => {
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
      if (!node) return;
      const widget = (node.widgets || []).find(w => w.name === "value" || w.name === "text" || w.type === "customtext");
      if (!widget) return;
      const current = widget.value || "";
      const separator = current.trim() ? ", " : "";
      widget.value = current + separator + appendText.trim();
      if (node.setDirtyCanvas) node.setDirtyCanvas(true, true);
      if (window.app?.graph?.setDirtyCanvas) window.app.graph.setDirtyCanvas(true, true);
    },
    args: [selectedText]
  });
});

// Ollamaプロキシ
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Message received:", request);
  
  if (request.type === "ollama-generate") {
    const serverUrl = request.serverUrl || "http://localhost:11434";
    
    fetch(serverUrl + "/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: request.model || "mistral",
        prompt: request.prompt,
        stream: false
      })
    })
    .then(res => res.json())
    .then(data => sendResponse({ success: true, response: data.response }))
    .catch(err => sendResponse({ success: false, error: err.message }));
    
    return true; // async response
  }
  
  if (request.type === "ollama-test") {
    const serverUrl = request.serverUrl || "http://localhost:11434";
    console.log("Testing connection to:", serverUrl);
    
    fetch(serverUrl + "/api/tags")
    .then(res => {
      if (res.ok) {
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: "Server error" });
      }
    })
    .catch(err => sendResponse({ success: false, error: err.message }));
    
    return true; // async response
  }
});
