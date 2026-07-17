chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "getPageContent") {
    const selectedText = window.getSelection()?.toString().trim() || "";
    const pageText = document.body.innerText || "";
    sendResponse({ selectedText, pageText, title: document.title });
  }

  if (message.action === "injectText") {
    const text = message.text;
    const activeEl = document.activeElement as HTMLElement | null;

    if (!activeEl) {
      sendResponse({ success: false, error: "포커스된 입력창이 없습니다." });
      return;
    }

    try {
      activeEl.focus();
      
      // execCommand를 사용하여 커서 위치에 텍스트 주입 (React/Vue 상태 변경 자동 감지 지원)
      const success = document.execCommand("insertText", false, text);
      
      if (!success) {
        // execCommand가 실패한 경우 (일반 input/textarea 대상 직접 바인딩)
        if (activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement) {
          activeEl.value = text;
          activeEl.dispatchEvent(new Event("input", { bubbles: true }));
          activeEl.dispatchEvent(new Event("change", { bubbles: true }));
        } else if (activeEl.isContentEditable) {
          activeEl.innerText = text;
          activeEl.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
      sendResponse({ success: true });
    } catch (error: any) {
      console.error("텍스트 주입 중 오류 발생:", error);
      sendResponse({ success: false, error: error.message });
    }
  }
  
  return true; // 비동기 응답 지원
});

// 드래그 선택 영역 변경 시 사이드패널로 실시간 텍스트 전달
document.addEventListener("selectionchange", () => {
  const selectedText = window.getSelection()?.toString().trim() || "";
  chrome.runtime.sendMessage({ action: "selectionChanged", selectedText })
    .catch(() => {
      // 사이드패널이 닫혀 있는 경우 발생하는 메시지 채널 오류를 무시합니다.
    });
});
