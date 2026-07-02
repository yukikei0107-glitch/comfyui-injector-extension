// ComfyUI サーバーの接続先設定。
// chrome.storage.local の "comfyui_base" で上書きでき（辞書画面の🖥ComfyUIサーバー欄）、
// 未設定なら下記のデフォルトを使う。デフォルトは自分の常用サーバーにしてある。
// ※ 公開リポジトリに出す場合はこのIPを localhost 等に変更すること。
const DEFAULT_COMFYUI_BASE = "http://100.64.162.109:8188";
let COMFYUI_BASE = DEFAULT_COMFYUI_BASE;

// 保存済みの接続先を読み込む。起動時の自動fetchより前に await したい場合は
// この Promise を使う（storage 読み込みは非同期のため）。
const comfyBaseReady = new Promise((resolve) => {
  try {
    chrome.storage.local.get("comfyui_base", (d) => {
      if (d && d.comfyui_base) COMFYUI_BASE = d.comfyui_base;
      resolve(COMFYUI_BASE);
    });
  } catch (e) {
    // chrome.storage が使えない環境では既定値のまま
    resolve(COMFYUI_BASE);
  }
});

// 設定変更を即時反映
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.comfyui_base) {
    COMFYUI_BASE = changes.comfyui_base.newValue || DEFAULT_COMFYUI_BASE;
  }
});
