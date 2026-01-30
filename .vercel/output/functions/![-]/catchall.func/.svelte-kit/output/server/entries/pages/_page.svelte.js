import { a2 as head, a4 as escape_html, a7 as attr, a8 as ensure_array_like } from "../../chunks/index.js";
import "@sveltejs/kit/internal";
import "../../chunks/exports.js";
import "../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../chunks/state.svelte.js";
import "lz-string";
import { marked } from "marked";
import hljs from "highlight.js";
const CRC8_TABLE = new Uint8Array(256);
(() => {
  const poly = 7;
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = crc & 128 ? crc << 1 ^ poly : crc << 1;
    }
    CRC8_TABLE[i] = crc & 255;
  }
})();
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x = x << 1;
    if (x & 256) {
      x ^= 285;
    }
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const renderer = new marked.Renderer();
    renderer.code = ({ text, lang }) => {
      const validLang = !!(lang && hljs.getLanguage(lang));
      const highlighted = validLang ? hljs.highlight(text, { language: lang }).value : hljs.highlightAuto(text).value;
      return `<div class="code-block-wrapper"><button class="copy-code-btn">Copy</button><pre><code class="hljs ${validLang ? "language-" + lang : ""}">${highlighted}</code></pre></div>`;
    };
    marked.use({ renderer });
    let inputText = "";
    let enablePassword = false;
    let enableTtl = false;
    let history = [];
    let charCount = inputText.length;
    let byteCount = new TextEncoder().encode(inputText).length;
    head("1uha8ag", $$renderer2, ($$renderer3) => {
      {
        $$renderer3.push("<!--[!-->");
        $$renderer3.title(($$renderer4) => {
          $$renderer4.push(`<title>Short - URL Clipboard | 通过 URL 分享文本</title>`);
        });
      }
      $$renderer3.push(`<!--]-->`);
    });
    $$renderer2.push(`<div class="page svelte-1uha8ag"><div class="container">`);
    {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push(`<section class="hero svelte-1uha8ag"><h1 class="hero-title svelte-1uha8ag">short</h1> <p class="hero-desc svelte-1uha8ag">无需服务器存储，文本直接编码在 URL 中<br/> 支持加密保护和过期时间设置</p></section> <div class="editor-card card svelte-1uha8ag"><div class="editor-section svelte-1uha8ag"><div class="section-header svelte-1uha8ag"><label for="input-text" class="section-title svelte-1uha8ag"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"></path></svg> 输入内容</label> <div class="section-actions svelte-1uha8ag"><span class="char-count svelte-1uha8ag">${escape_html(charCount)} 字符 · ${escape_html(byteCount)} 字节</span> `);
      {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--></div></div> <textarea id="input-text" class="editor-textarea svelte-1uha8ag" placeholder="在这里输入要分享的文本..." spellcheck="false">`);
      const $$body = escape_html(inputText);
      if ($$body) {
        $$renderer2.push(`${$$body}`);
      }
      $$renderer2.push(`</textarea></div> <div class="options-section svelte-1uha8ag"><div class="option-group svelte-1uha8ag"><label class="option-toggle svelte-1uha8ag"><input type="checkbox"${attr("checked", enablePassword, true)} class="svelte-1uha8ag"/> <span class="toggle-track svelte-1uha8ag"><span class="toggle-thumb svelte-1uha8ag"></span></span> <span class="option-label svelte-1uha8ag"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> 密码保护</span></label> `);
      {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--></div> <div class="option-group svelte-1uha8ag"><label class="option-toggle svelte-1uha8ag"><input type="checkbox"${attr("checked", enableTtl, true)} class="svelte-1uha8ag"/> <span class="toggle-track svelte-1uha8ag"><span class="toggle-thumb svelte-1uha8ag"></span></span> <span class="option-label svelte-1uha8ag"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> 过期时间</span></label> `);
      {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--></div></div> `);
      {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--></div> <section class="features svelte-1uha8ag"><div class="feature svelte-1uha8ag"><div class="feature-icon svelte-1uha8ag"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg></div> <h3 class="svelte-1uha8ag">客户端加密</h3> <p class="svelte-1uha8ag">使用 AES-GCM 加密，密码不离开浏览器</p></div> <div class="feature svelte-1uha8ag"><div class="feature-icon svelte-1uha8ag"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></div> <h3 class="svelte-1uha8ag">阅后即焚</h3> <p class="svelte-1uha8ag">设置过期时间，超时后自动失效</p></div> <div class="feature svelte-1uha8ag"><div class="feature-icon svelte-1uha8ag"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"></path><path d="m9 12 2 2 4-4"></path></svg></div> <h3 class="svelte-1uha8ag">无需数据库</h3> <p class="svelte-1uha8ag">数据完全存储在 URL 中，无需信任第三方</p></div></section> `);
      if (history.length > 0) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<section class="history-section svelte-1uha8ag"><div class="history-header svelte-1uha8ag"><h2 class="svelte-1uha8ag">History</h2> <button class="btn-text svelte-1uha8ag">Clear</button></div> <div class="history-list svelte-1uha8ag"><!--[-->`);
        const each_array = ensure_array_like(history);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let item = each_array[$$index];
          $$renderer2.push(`<button class="history-item svelte-1uha8ag"><div class="history-content svelte-1uha8ag">${escape_html(item.content)}</div> <div class="history-meta svelte-1uha8ag"><span class="history-date">${escape_html(new Date(item.timestamp).toLocaleDateString())}</span> <div class="history-badges svelte-1uha8ag">`);
          if (item.isEncrypted) {
            $$renderer2.push("<!--[-->");
            $$renderer2.push(`<span class="mini-badge svelte-1uha8ag">🔒</span>`);
          } else {
            $$renderer2.push("<!--[!-->");
          }
          $$renderer2.push(`<!--]--> `);
          if (item.hasTtl) {
            $$renderer2.push("<!--[-->");
            $$renderer2.push(`<span class="mini-badge svelte-1uha8ag">⏱️</span>`);
          } else {
            $$renderer2.push("<!--[!-->");
          }
          $$renderer2.push(`<!--]--></div></div></button>`);
        }
        $$renderer2.push(`<!--]--></div></section>`);
      } else {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></div></div>`);
  });
}
export {
  _page as default
};
