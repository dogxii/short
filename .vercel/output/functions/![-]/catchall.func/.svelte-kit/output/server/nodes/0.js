

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export const imports = ["_app/immutable/nodes/0.DG3X53S7.js","_app/immutable/chunks/VTTA9KKB.js","_app/immutable/chunks/5YLi0f_w.js","_app/immutable/chunks/DtF8FWCc.js"];
export const stylesheets = ["_app/immutable/assets/0.DVNUFT_0.css"];
export const fonts = [];
