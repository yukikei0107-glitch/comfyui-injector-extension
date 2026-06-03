// ComfyUI ページ上で動作するスクリプト

function appendToPositivePrompt(appendText) {
  const app = window.app;
  if (!app || !app.graph) return { error: "ComfyUI が読み込まれていません" };

  const nodes = app.graph._nodes || [];
  
  // ポジティブノードを探す
  const POSITIVE_KEYWORDS = ["positive", "ポジティブ"];
  const NEGATIVE_KEYWORDS = ["negative", "ネガティブ", "neg"];

  let targetNode = null;
  let fallbackNode = null;

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
  if (!node) return { error: "ポジティブプロンプトノードが見つかりません" };

  // ウィジェットを探す
  const widget = (node.widgets || []).find(w =>
    w.name === "value" || w.name === "text" || w.type === "customtext"
  );
  if (!widget) return { error: "テキストウィジェットが見つかりません (node: " + node.title + ")" };

  const current = widget.value || "";
  const separator = current.trim() ? ", " : "";
  widget.value = current + separator + appendText.trim();

  // 再描画
  if (node.setDirtyCanvas) node.setDirtyCanvas(true, true);
  if (app.graph.setDirtyCanvas) app.graph.setDirtyCanvas(true, true);

  return { success: true, node: node.title };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "CHECK_READY") {
    const ready = !!(window.app && window.app.graph && window.app.graph._nodes?.length);
    sendResponse({ ready });
  }
  if (message.type === "APPEND_PROMPT") {
    sendResponse(appendToPositivePrompt(message.text));
  }
  return true;
});
