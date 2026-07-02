const statusEl = document.getElementById("status");
const promptInput = document.getElementById("prompt-input");
const btnPaste = document.getElementById("btn-paste");
const btnInject = document.getElementById("btn-inject");
const btnGenerate = document.getElementById("btn-generate");
const spinner = document.getElementById("spinner");
const placeholder = document.getElementById("placeholder");
const resultImage = document.getElementById("result-image");

// COMFYUI_BASE は config.js（このスクリプトより前に読み込む）が提供する

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.className = "status" + (isError ? " error" : "");
}

async function getComfyTab() {
  return new Promise(resolve =>
    chrome.tabs.query({ url: `${COMFYUI_BASE}/*` }, tabs =>
      resolve(tabs?.[0] || null)
    )
  );
}

async function injectPrompt(text) {
  const tab = await getComfyTab();
  if (!tab) { setStatus("ComfyUI タブが見つかりません", true); return false; }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
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
      if (!node) return { error: "ノードが見つかりません" };

      const widget = (node.widgets || []).find(w =>
        w.name === "value" || w.name === "text" || w.type === "customtext"
      );
      if (!widget) return { error: "ウィジェットが見つかりません" };

      widget.value = appendText.trim();

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

  // まずノードに反映
  const tab = await getComfyTab();
  if (!tab) { setStatus("ComfyUI タブが見つかりません", true); return; }

  // ワークフローを取得してプロンプトを差し替えてキューに送る
  setStatus("ワークフロー取得中...");
  spinner.style.display = "block";
  placeholder.style.display = "none";
  resultImage.style.display = "none";
  btnGenerate.disabled = true;

  try {
    // 最新のワークフローを履歴から取得
    const histRes = await fetch(`${COMFYUI_BASE}/history`);
    const history = await histRes.json();
    const keys = Object.keys(history);
    if (!keys.length) { setStatus("ワークフロー履歴がありません。一度手動で実行してください", true); return; }

    const workflow = history[keys[keys.length - 1]].prompt[2];

    // ポジティブプロンプトノードを差し替え
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

    // KSamplerのseedをランダムに書き換え
    const newSeed = Math.floor(Math.random() * 2**32);
    for (const [id, node] of Object.entries(workflow)) {
      const type = (node.class_type || "").toLowerCase();
      if (type === "ksampler" || type === "ksampleradvanced") {
        if ("seed" in node.inputs) {
          node.inputs.seed = newSeed;
        }
        // control_after_generateはそのまま維持（randomizeはComfyUI側に任せる）
      }
    }

    // エディタ上のKSamplerノードのseedも更新
    const tab2 = await getComfyTab();
    if (tab2) {
      await chrome.scripting.executeScript({
        target: { tabId: tab2.id },
        world: "MAIN",
        func: (newSeed) => {
          const nodes = window.app?.graph?._nodes || [];
          for (const node of nodes) {
            const type = (node.type || "").toLowerCase();
            if (type === "ksampler" || type === "ksampleradvanced") {
              const widget = (node.widgets || []).find(w => w.name === "seed");
              if (widget) widget.value = newSeed;
              if (node.setDirtyCanvas) node.setDirtyCanvas(true, true);
            }
          }
        },
        args: [newSeed]
      });
    }

    // キューに送信
    setStatus("生成中...");
    const queueRes = await fetch(`${COMFYUI_BASE}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow, client_id: "comfyui_ext" })
    });
    const queueData = await queueRes.json();
    const promptId = queueData.prompt_id;
    if (!promptId) { setStatus("キューへの送信に失敗しました", true); return; }

    // 完了を待つ
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
    const res = await fetch(`${COMFYUI_BASE}/history/${promptId}`);
    const data = await res.json();
    const entry = data[promptId];
    if (!entry) continue;

    const outputs = entry.outputs;
    for (const nodeOut of Object.values(outputs)) {
      if (nodeOut.images && nodeOut.images.length > 0) {
        const img = nodeOut.images[0];
        const imgUrl = `${COMFYUI_BASE}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || "")}&type=${img.type}`;
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

// 起動時にポジティブプロンプトの現在値を読み込む
async function loadCurrentPrompt() {
  const tab = await getComfyTab();
  if (!tab) return;

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: "MAIN",
    func: () => {
      const POSITIVE_KEYWORDS = ["positive", "ポジティブ"];
      const NEGATIVE_KEYWORDS = ["negative", "ネガティブ", "neg"];
      const nodes = window.app?.graph?._nodes || [];
      for (const node of nodes) {
        const title = (node.title || "").toLowerCase();
        const type = (node.type || "").toLowerCase();
        const isText = type === "cliptextencode" || type === "primitivestringmultiline";
        const isPos = POSITIVE_KEYWORDS.some(k => title.includes(k));
        if (isText && isPos) {
          const widget = (node.widgets || []).find(w =>
            w.name === "value" || w.name === "text" || w.type === "customtext"
          );
          return widget?.value || "";
        }
      }
      return "";
    }
  });

  const text = results?.[0]?.result;
  if (text) promptInput.value = text;
}

// クリップボードから貼り付け
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

// ノードに反映
btnInject.addEventListener("click", async () => {
  const text = promptInput.value.trim();
  if (!text) { setStatus("プロンプトを入力してください", true); return; }
  await injectPrompt(text);
});

// 生成
btnGenerate.addEventListener("click", generateImage);

// 起動時に現在のプロンプトを読み込む
setTimeout(loadCurrentPrompt, 300);
