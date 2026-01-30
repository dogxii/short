import { a2 as head } from "../../chunks/index.js";
function _layout($$renderer, $$props) {
  let { children } = $$props;
  head("12qhfyh", $$renderer, ($$renderer2) => {
    $$renderer2.title(($$renderer3) => {
      $$renderer3.push(`<title>Short - URL Clipboard</title>`);
    });
  });
  $$renderer.push(`<div class="layout svelte-12qhfyh"><header class="header svelte-12qhfyh"><div class="container header-inner svelte-12qhfyh"><a href="/" class="logo svelte-12qhfyh"><span class="logo-text svelte-12qhfyh">s.dogxi.me</span></a> <nav class="nav svelte-12qhfyh"><a href="https://github.com/dogxii/dxcode" target="_blank" rel="noopener noreferrer" class="nav-link svelte-12qhfyh" aria-label="GitHub"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path><path d="M9 18c-4.51 2-5-2-7-2"></path></svg></a></nav></div></header> <main class="main svelte-12qhfyh">`);
  children($$renderer);
  $$renderer.push(`<!----></main> <footer class="footer svelte-12qhfyh"><div class="container footer-inner svelte-12qhfyh"><span class="footer-text svelte-12qhfyh">Built by <a href="https://blog.dogxi.me" target="_blank" class="svelte-12qhfyh">Dogxi</a></span> <span class="footer-divider svelte-12qhfyh">·</span> <span class="footer-text text-tertiary">No server, pure URL magic</span></div></footer></div>`);
}
export {
  _layout as default
};
