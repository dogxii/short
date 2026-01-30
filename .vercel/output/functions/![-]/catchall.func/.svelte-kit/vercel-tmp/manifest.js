export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["favicon.svg"]),
	mimeTypes: {".svg":"image/svg+xml"},
	_: {
		client: {start:"_app/immutable/entry/start.CmvE9R40.js",app:"_app/immutable/entry/app.yRoXjaA5.js",imports:["_app/immutable/entry/start.CmvE9R40.js","_app/immutable/chunks/DqFPRWEw.js","_app/immutable/chunks/5YLi0f_w.js","_app/immutable/chunks/Bwv2NfKc.js","_app/immutable/chunks/C6H-UPLo.js","_app/immutable/entry/app.yRoXjaA5.js","_app/immutable/chunks/5YLi0f_w.js","_app/immutable/chunks/DMc7hGZ6.js","_app/immutable/chunks/VTTA9KKB.js","_app/immutable/chunks/Bwv2NfKc.js","_app/immutable/chunks/D8O2uFCm.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('../output/server/nodes/0.js')),
			__memo(() => import('../output/server/nodes/1.js')),
			__memo(() => import('../output/server/nodes/2.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
