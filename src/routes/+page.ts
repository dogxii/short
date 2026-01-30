// 禁用 SSR，因为需要在客户端处理 URL 参数
export const ssr = false;

// 不预渲染，因为内容是动态的（依赖 URL 参数）
export const prerender = false;
