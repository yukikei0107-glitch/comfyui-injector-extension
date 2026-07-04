// COMFYUI_BASE は config.js（このスクリプトより前に読み込む）が提供する
const grid = document.getElementById("grid");
const statusEl = document.getElementById("status");

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

function makeEditMode(promptEl, editActionsEl, promptText, workflow, cardStatusEl) {
  // テキストエリアに差し替え
  const textarea = document.createElement("textarea");
  textarea.className = "card-prompt-edit";
  textarea.value = promptText;
  promptEl.replaceWith(textarea);
  textarea.focus();

  editActionsEl.style.display = "flex";

  const btnCancel = editActionsEl.querySelector(".btn-cancel-edit");

  btnCancel.onclick = () => {
    exitEdit(textarea, promptText);
  };

  function exitEdit(el, text) {
    const newPromptEl = document.createElement("div");
    newPromptEl.className = "card-prompt";
    newPromptEl.title = "クリックして編集";
    newPromptEl.textContent = text;
    el.replaceWith(newPromptEl);
    editActionsEl.style.display = "none";
    // 再度クリック編集を有効化
    newPromptEl.addEventListener("click", () =>
      makeEditMode(newPromptEl, editActionsEl, text, workflow, cardStatusEl)
    );
  }
}

async function loadHistory() {
  statusEl.textContent = "読み込み中...";
  grid.innerHTML = "";

  try {
    const history = await bgFetch(`${COMFYUI_BASE}/history`);
    const entries = Object.values(history).reverse();

    if (!entries.length) {
      grid.innerHTML = '<div class="empty-msg">履歴がありません</div>';
      statusEl.textContent = "0件";
      return;
    }

    statusEl.textContent = `${entries.length}件`;

    for (const entry of entries) {
      const prompt = entry.prompt?.[2];
      const outputs = entry.outputs;
      if (!prompt || !outputs) continue;

      // ポジティブプロンプトを取得
      let positiveText = "";
      for (const node of Object.values(prompt)) {
        const title = (node._meta?.title || "").toLowerCase();
        const type = (node.class_type || "").toLowerCase();
        const isPos = ["positive", "ポジティブ"].some(k => title.includes(k));
        if ((type === "cliptextencode" || type === "primitivestringmultiline") && isPos) {
          positiveText = node.inputs?.value || node.inputs?.text || "";
          break;
        }
      }

      // seedを取得
      let seed = "";
      for (const node of Object.values(prompt)) {
        const type = (node.class_type || "").toLowerCase();
        if (type === "ksampler" || type === "ksampleradvanced") {
          seed = node.inputs?.seed || "";
          break;
        }
      }

      // 画像を取得
      const images = [];
      for (const nodeOut of Object.values(outputs)) {
        if (nodeOut.images?.length) {
          for (const img of nodeOut.images) {
            if ((img.subfolder || "").startsWith("costume_preview")) continue; // 衣装ガチャのプレビューは履歴に出さない
            images.push(img);
          }
        }
      }
      if (!images.length) continue;

      // 日時をファイル名から取得
      const filename = images[0].filename || "";
      const dateMatch = filename.match(/(\d{8})_(\d{6})/);
      let dateStr = "";
      if (dateMatch) {
        const d = dateMatch[1], t = dateMatch[2];
        dateStr = `${d.slice(0,4)}/${d.slice(4,6)}/${d.slice(6,8)} ${t.slice(0,2)}:${t.slice(2,4)}:${t.slice(4,6)}`;
      }

      for (const img of images) {
        if (!img.subfolder) continue;
        const imgUrl = `${COMFYUI_BASE}/api/view?filename=${encodeURIComponent(img.filename)}&type=${img.type}&subfolder=${encodeURIComponent(img.subfolder)}`;

        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
          <img class="card-img" src="${imgUrl}" loading="lazy" alt="生成画像">
          <div class="card-body">
            ${dateStr ? `<div class="card-date">📅 ${dateStr}</div>` : ""}
            <div class="card-prompt" title="クリックして編集">${positiveText || "（プロンプト不明）"}</div>
            <div class="edit-actions" style="display:none;">
              <button class="btn-cancel-edit">✕</button>
            </div>
            <div class="card-status"></div>
            ${seed ? `<div class="card-seed">🎲 seed: ${seed}</div>` : ""}
            <div class="card-actions">
              <button class="btn-use btn-use-prompt">コントロールで使う</button>
            </div>
          </div>
        `;

        const promptEl = card.querySelector(".card-prompt");
        const editActionsEl = card.querySelector(".edit-actions");
        const cardStatusEl = card.querySelector(".card-status");

        promptEl.addEventListener("click", () =>
          makeEditMode(promptEl, editActionsEl, positiveText, prompt, cardStatusEl)
        );

        card.querySelector(".btn-use-prompt").addEventListener("click", () => {
          // 送り先（最後に見ていたコントロール画面）の判定はbackgroundに任せる
          chrome.runtime.sendMessage({ type: "USE_IN_CONTROL", text: positiveText, imageUrl: imgUrl });
        });

        grid.appendChild(card);
      }
    }
  } catch (e) {
    statusEl.textContent = "エラー: " + e.message;
    grid.innerHTML = '<div class="empty-msg">履歴の取得に失敗しました</div>';
  }
}

document.getElementById("btn-refresh").addEventListener("click", loadHistory);
comfyBaseReady.then(loadHistory);
