import { a3 as getContext, a4 as escape_html, a5 as store_get, a6 as unsubscribe_stores } from "../../chunks/index.js";
import "clsx";
import "@sveltejs/kit/internal";
import "../../chunks/exports.js";
import "../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../chunks/state.svelte.js";
const getStores = () => {
  const stores = getContext("__svelte__");
  return {
    /** @type {typeof page} */
    page: {
      subscribe: stores.page.subscribe
    },
    /** @type {typeof navigating} */
    navigating: {
      subscribe: stores.navigating.subscribe
    },
    /** @type {typeof updated} */
    updated: stores.updated
  };
};
const page = {
  subscribe(fn) {
    const store = getStores().page;
    return store.subscribe(fn);
  }
};
function _error($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    $$renderer2.push(`<div class="error-page svelte-1j96wlh"><div class="container"><div class="error-content svelte-1j96wlh"><h1 class="error-code svelte-1j96wlh">${escape_html(store_get($$store_subs ??= {}, "$page", page).status)}</h1> <p class="error-message svelte-1j96wlh">`);
    if (store_get($$store_subs ??= {}, "$page", page).status === 404) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`页面未找到`);
    } else {
      $$renderer2.push("<!--[!-->");
      if (store_get($$store_subs ??= {}, "$page", page).status === 500) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`服务器错误`);
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push(`${escape_html(store_get($$store_subs ??= {}, "$page", page).error?.message || "发生了错误")}`);
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></p> <a href="/" class="btn btn-primary">返回首页</a></div></div></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _error as default
};
