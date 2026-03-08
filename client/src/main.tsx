import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// 全局未捕获错误处理：移动端/WebView 常因崩溃显示「加载失败」并关页，此处展示可点击刷新，避免白屏
function showGlobalErrorOverlay() {
  if (document.getElementById("global-error-overlay")) return;
  const el = document.createElement("div");
  el.id = "global-error-overlay";
  el.style.cssText =
    "position:fixed;inset:0;z-index:99999;background:rgba(232,224,208,0.98);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px;font-family:'Noto Serif SC',serif;";
  el.innerHTML = `
    <p style="color:#6B6560;font-size:16px;text-align:center;margin:0;">加载异常，请点击下方按钮刷新</p>
    <button type="button" onclick="window.location.reload()" style="padding:12px 24px;background:#C4463A;color:#fff;border:none;border-radius:8px;font-size:16px;cursor:pointer;">刷新页面</button>
  `;
  document.body.appendChild(el);
}

window.addEventListener("error", (event) => {
  console.error("[global error]", event.error ?? event.message);
  showGlobalErrorOverlay();
});
window.addEventListener("unhandledrejection", (event) => {
  console.error("[unhandled rejection]", event.reason);
  // 仅对类似「脚本错误」的 rejection 展示覆盖层，避免网络失败等误弹
  const msg = String(event.reason?.message ?? event.reason ?? "");
  if (msg && !/fetch|network|load|failed to fetch/i.test(msg)) showGlobalErrorOverlay();
});

createRoot(document.getElementById("root")!).render(<App />);
