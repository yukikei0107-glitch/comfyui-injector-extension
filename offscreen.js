chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === "READ_CLIPBOARD") {
    try {
      const text = await navigator.clipboard.readText();
      chrome.runtime.sendMessage({ type: "CLIPBOARD_RESULT", text });
    } catch (e) {
      chrome.runtime.sendMessage({ type: "CLIPBOARD_RESULT", text: "" });
    }
  }
});
