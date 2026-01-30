

export const index = 2;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_page.svelte.js')).default;
export const universal = {
  "ssr": false,
  "prerender": false
};
export const universal_id = "src/routes/+page.ts";
export const imports = ["_app/immutable/nodes/2.BB6s4gda.js","_app/immutable/chunks/VTTA9KKB.js","_app/immutable/chunks/5YLi0f_w.js","_app/immutable/chunks/Bwv2NfKc.js","_app/immutable/chunks/DMc7hGZ6.js","_app/immutable/chunks/DtF8FWCc.js","_app/immutable/chunks/C6H-UPLo.js"];
export const stylesheets = ["_app/immutable/assets/2.C66NAiJU.css"];
export const fonts = [];
