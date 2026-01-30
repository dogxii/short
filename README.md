# Short - 无服务器 URL 剪贴板

Short 是一个现代化的无服务器 URL 剪贴板工具，让你可以通过 URL 安全地分享文本、代码和 Markdown 内容。

与传统的 Pastebin 或短链接服务不同，**Short 不会将你的数据存储在服务器上**。相反，它将你的内容压缩、加密（可选）并直接编码到 URL 的哈希/查询参数中。这意味着你的数据与链接本身一样持久，并且完全隐私。

## ✨ 功能特性

- **🚫 无服务器架构**：没有数据库，没有后端存储。数据完全存在于 URL 中。
- **🔒 客户端加密**：可选的 AES-256-GCM 加密。密码永远不会离开你的浏览器。
- **📦 智能压缩**：使用 `lz-string` (SPack v3) 将更多数据压缩进更短的链接中。
- **⏱️ 过期时间 (TTL)**：为链接设置过期时间（解码时强制检查）。
- **📝 Markdown 与语法高亮**：自动渲染 Markdown 并高亮代码块。
- **📱 二维码生成**：一键生成二维码，方便移动端分享。
- **📜 本地历史记录**：在本地记录你创建或访问过的链接。
- **🌗 纯黑白主题**：干净、高对比度的黑白设计，专注于内容。

## 🛠️ 技术栈

- **框架**: [Svelte 5](https://svelte.dev) + [SvelteKit](https://kit.svelte.dev)
- **语言**: TypeScript
- **构建工具**: Vite
- **样式**: 原生 CSS 变量 (黑白主题)
- **加密**: Web Crypto API
- **库**:
  - `lz-string`: URL 安全的压缩算法
  - `marked`: Markdown 解析
  - `highlight.js`: 代码语法高亮

## 🚀 快速开始

### 前置要求

- Node.js (v18+)
- Bun (推荐) 或 npm/pnpm

### 安装

1. 克隆仓库：

   ```bash
   git clone https://github.com/dogxii/dxcode.git
   cd dxcode/short
   ```

2. 安装依赖：
   ```bash
   bun install
   # 或
   npm install
   ```

### 开发

启动开发服务器：

```bash
bun run dev
# 或
npm run dev
```

访问 `http://localhost:5173` 查看应用。

### 构建生产版本

构建应用（默认配置为 Vercel 适配器）：

```bash
bun run build
# 或
npm run build
```

## 📐 SPack 协议 (v3)

本项目使用名为 **SPack** 的自定义打包格式来管理 URL 中的数据。

**格式结构：**

```
[版本: 1 byte][标志位: 1 byte][校验和: 1 byte][头部...][载荷...]
```

- **版本**：当前版本为 `3`。
- **标志位**：指示是否启用压缩、加密以及是否存在 TTL。
- **校验和**：用于完整性验证的 CRC8 校验和。
- **头部**：包含元数据，如时间戳、TTL 时长、盐值 (Salt) 和初始向量 (IV)（如果已加密）。
- **载荷**：经过压缩（和可选加密）的内容。

## 📦 部署

本项目配置了 `@sveltejs/adapter-vercel`。

1. 将代码推送到 Git 仓库 (GitHub/GitLab)。
2. 在 **Vercel** 中导入项目。
3. Vercel 会自动检测 SvelteKit 并进行部署。
4. 在 Vercel 设置中绑定你的自定义域名。

## 📄 许可证

MIT License. 详见 [LICENSE](../LICENSE) 文件。

---

Built with ❤️ by [Dogxi](https://blog.dogxi.me).
