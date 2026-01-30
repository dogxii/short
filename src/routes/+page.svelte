<script lang="ts">
  import { page } from '$app/stores'
  import {
    encode,
    encodeAsync,
    decode,
    decodeAsync,
    getInfo,
    isValid,
    isEncrypted,
    hasTtl,
    getTtlInfo,
    formatRemainingTime,
    type EncodeInfo,
    type TtlInfo,
  } from '$lib/spack'
  import { generateQRCodeSvg } from '$lib/qrcode'
  import { fade, slide, scale } from 'svelte/transition'
  import { onMount, untrack } from 'svelte'
  import { marked } from 'marked'
  import hljs from 'highlight.js'
  import 'highlight.js/styles/atom-one-dark.css'

  // Configure marked with highlight.js
  const renderer = new marked.Renderer()
  renderer.code = ({ text, lang }) => {
    const validLang = !!(lang && hljs.getLanguage(lang))
    const highlighted = validLang
      ? hljs.highlight(text, { language: lang }).value
      : hljs.highlightAuto(text).value
    return `<div class="code-block-wrapper"><button class="copy-code-btn">Copy</button><pre><code class="hljs ${validLang ? 'language-' + lang : ''}">${highlighted}</code></pre></div>`
  }
  marked.use({ renderer })

  // Mode: 'create' or 'view'
  let mode = $state<'create' | 'view'>('create')

  // Create mode state
  let inputText = $state('')
  let generatedLink = $state('')
  let copied = $state(false)
  let copiedContent = $state(false)
  let error = $state('')
  let isGenerating = $state(false)

  // Options
  let enablePassword = $state(false)
  let password = $state('')
  let confirmPassword = $state('')
  let enableTtl = $state(false)
  let ttlValue = $state(1)
  let ttlUnit = $state<'hours' | 'days' | 'minutes'>('hours')
  let showQrCode = $state(false)

  // View mode state
  let decodedContent = $state('')
  let viewError = $state('')
  let loading = $state(true)
  let needsPassword = $state(false)
  let viewPassword = $state('')
  let isDecrypting = $state(false)
  let viewTtlInfo = $state<TtlInfo | null>(null)
  let encodedData = $state('')

  // History
  interface HistoryItem {
    id: string
    content: string
    encoded: string
    timestamp: number
    hasTtl: boolean
    isEncrypted: boolean
  }
  let history = $state<HistoryItem[]>([])

  // Derived
  let charCount = $derived(inputText.length)
  let byteCount = $derived(new TextEncoder().encode(inputText).length)
  let linkInfo = $derived(
    generatedLink ? getInfo(getCodeFromLink(generatedLink)) : null,
  )
  let passwordsMatch = $derived(!enablePassword || password === confirmPassword)
  let qrCodeSvg = $derived.by(() => {
    if (!generatedLink || !showQrCode) return null
    return generateQRCodeSvg(generatedLink, {
      size: 200,
      margin: 2,
      darkColor: 'currentColor',
      lightColor: 'transparent',
    })
  })

  // TTL in seconds
  let ttlSeconds = $derived.by(() => {
    if (!enableTtl) return 0
    switch (ttlUnit) {
      case 'minutes':
        return ttlValue * 60
      case 'hours':
        return ttlValue * 3600
      case 'days':
        return ttlValue * 86400
      default:
        return 0
    }
  })

  // Constants
  const MAX_URL_LENGTH = 8000
  const BASE_URL =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://s.dogxi.me'

  onMount(() => {
    // Load history
    const saved = localStorage.getItem('short_history')
    if (saved) {
      try {
        history = JSON.parse(saved)
      } catch (e) {
        console.error('Failed to load history', e)
      }
    }
  })

  $effect(() => {
    const encoded = $page.url.searchParams.get('t')

    if (encoded) {
      mode = 'view'
      loading = true
      encodedData = encoded
      // Reset state
      needsPassword = false
      viewPassword = ''
      decodedContent = ''
      viewError = ''
      viewTtlInfo = null

      try {
        if (!isValid(encoded)) {
          viewError = '无效的编码数据'
          loading = false
          return
        }

        // Check if encrypted
        if (isEncrypted(encoded)) {
          needsPassword = true
          loading = false
          // Get TTL info if available
          if (hasTtl(encoded)) {
            viewTtlInfo = getTtlInfo(encoded)
          }
          return
        }

        // Get TTL info
        if (hasTtl(encoded)) {
          viewTtlInfo = getTtlInfo(encoded)
        }

        // Try to decode
        decodedContent = decode(encoded, { checkTtl: true })
        untrack(() =>
          addToHistory(encoded, decodedContent, hasTtl(encoded), false),
        )
        viewError = ''
        loading = false
      } catch (e) {
        viewError = e instanceof Error ? e.message : '解码失败'
        loading = false
      }
    } else {
      mode = 'create'
      loading = false
    }
  })

  function addToHistory(
    encoded: string,
    content: string,
    hasTtl: boolean,
    isEncrypted: boolean,
  ) {
    const item: HistoryItem = {
      id: Math.random().toString(36).substring(2, 9),
      content: content.slice(0, 50) + (content.length > 50 ? '...' : ''),
      encoded,
      timestamp: Date.now(),
      hasTtl,
      isEncrypted,
    }

    history = [item, ...history.filter((h) => h.encoded !== encoded)].slice(
      0,
      10,
    )
    localStorage.setItem('short_history', JSON.stringify(history))
  }

  function clearHistory() {
    history = []
    localStorage.removeItem('short_history')
  }

  function restoreFromHistory(item: HistoryItem) {
    mode = 'create'
    if (!item.isEncrypted) {
      try {
        inputText = decode(item.encoded, { checkTtl: false })
      } catch {
        // ignore
      }
    } else {
      inputText = ''
    }
    generatedLink = `${BASE_URL}/?t=${item.encoded}`
    showQrCode = false
    copied = false
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function getCodeFromLink(link: string): string {
    try {
      const url = new URL(link)
      return url.searchParams.get('t') || ''
    } catch {
      return ''
    }
  }

  async function generateLink() {
    error = ''
    generatedLink = ''

    if (!inputText.trim()) {
      return
    }

    if (enablePassword && !passwordsMatch) {
      error = '两次输入的密码不一致'
      return
    }

    if (enablePassword && password.length < 4) {
      error = '密码至少需要 4 个字符'
      return
    }

    isGenerating = true

    try {
      let encoded: string

      if (enablePassword || enableTtl) {
        encoded = await encodeAsync(inputText, {
          password: enablePassword ? password : undefined,
          ttlSeconds: enableTtl ? ttlSeconds : undefined,
        })
      } else {
        encoded = encode(inputText)
      }

      const link = `${BASE_URL}/?t=${encoded}`

      if (link.length > MAX_URL_LENGTH) {
        error = `内容过长，URL 超出安全限制 (${link.length}/${MAX_URL_LENGTH} 字符)`
        return
      }

      generatedLink = link
    } catch (e) {
      error = e instanceof Error ? e.message : '编码失败'
    } finally {
      isGenerating = false
    }
  }

  async function copyLink() {
    if (!generatedLink) return

    try {
      await navigator.clipboard.writeText(generatedLink)
      copied = true

      // Add to history
      const code = getCodeFromLink(generatedLink)
      if (code) {
        addToHistory(code, inputText, hasTtl(code), isEncrypted(code))
      }

      setTimeout(() => {
        copied = false
      }, 2000)
    } catch {
      error = '复制失败'
    }
  }

  async function copyContent() {
    if (!decodedContent) return

    try {
      await navigator.clipboard.writeText(decodedContent)
      copiedContent = true
      setTimeout(() => {
        copiedContent = false
      }, 2000)
    } catch {
      viewError = '复制失败'
    }
  }

  function clear() {
    inputText = ''
    generatedLink = ''
    error = ''
    copied = false
    showQrCode = false
  }

  function openPreview() {
    if (generatedLink) {
      window.open(generatedLink, '_blank')
    }
  }

  function switchToCreate() {
    mode = 'create'
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/')
    }
  }

  function handleMarkdownClick(event: MouseEvent) {
    const target = event.target as HTMLElement
    if (target.classList.contains('copy-code-btn')) {
      const wrapper = target.closest('.code-block-wrapper')
      const code = wrapper?.querySelector('code')?.innerText
      if (code) {
        navigator.clipboard.writeText(code)
        const originalText = target.textContent
        target.textContent = 'Copied!'
        setTimeout(() => (target.textContent = originalText), 2000)
      }
    }
  }

  async function decodeWithPassword() {
    if (!viewPassword) {
      viewError = '请输入密码'
      return
    }

    isDecrypting = true
    viewError = ''

    try {
      decodedContent = await decodeAsync(encodedData, {
        password: viewPassword,
        checkTtl: true,
      })
      addToHistory(encodedData, decodedContent, hasTtl(encodedData), true)
      needsPassword = false
      viewError = ''
    } catch (e) {
      viewError = e instanceof Error ? e.message : '解码失败'
    } finally {
      isDecrypting = false
    }
  }

  // Auto-generate on input change
  $effect(() => {
    if (mode === 'create' && inputText) {
      generateLink()
    } else if (mode === 'create') {
      generatedLink = ''
      error = ''
    }
  })

  // Regenerate when options change
  $effect(() => {
    if (mode === 'create' && inputText && (enablePassword || enableTtl)) {
      // Trigger regeneration
      void (enablePassword && password && passwordsMatch)
      void (enableTtl && ttlSeconds)
    }
  })
</script>

<svelte:head>
  {#if mode === 'view'}
    <title>查看内容 | Short</title>
    <meta name="robots" content="noindex" />
  {:else}
    <title>Short - URL Clipboard | 通过 URL 分享文本</title>
  {/if}
</svelte:head>

<div class="page">
  <div class="container">
    {#if mode === 'view'}
      <!-- View Mode -->
      <div class="view-mode" in:fade={{ duration: 200 }}>
        {#if loading}
          <div class="loading-state">
            <div class="spinner"></div>
            <p>正在解码...</p>
          </div>
        {:else if needsPassword}
          <!-- Password Input -->
          <div class="password-card card" in:fade>
            <div class="password-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h2>内容已加密</h2>
            <p class="password-hint">请输入密码查看内容</p>

            {#if viewTtlInfo}
              <div class="ttl-badge" class:expired={viewTtlInfo.isExpired}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {#if viewTtlInfo.isExpired}
                  已过期
                {:else}
                  {formatRemainingTime(viewTtlInfo.remainingSeconds)}
                {/if}
              </div>
            {/if}

            <div class="password-form">
              <input
                type="password"
                class="password-input"
                placeholder="输入密码"
                bind:value={viewPassword}
                onkeydown={(e) => e.key === 'Enter' && decodeWithPassword()}
              />
              <button
                class="btn btn-primary btn-lg"
                onclick={decodeWithPassword}
                disabled={isDecrypting || !viewPassword}
              >
                {#if isDecrypting}
                  <span class="btn-spinner"></span>
                  解密中...
                {:else}
                  解锁
                {/if}
              </button>
            </div>

            {#if viewError}
              <p class="password-error">{viewError}</p>
            {/if}
          </div>
        {:else if viewError}
          <div class="error-card card">
            <div class="error-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h2>解码失败</h2>
            <p class="error-message">{viewError}</p>
            <button class="btn btn-primary" onclick={switchToCreate}>
              创建新内容
            </button>
          </div>
        {:else}
          <div class="content-card card">
            <!-- Header -->
            <div class="content-header">
              <div class="header-left">
                <h1 class="content-title">
                  <span class="title-icon">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path
                        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                      />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  </span>
                  分享的内容
                </h1>
                <div class="content-badges">
                  <span class="meta-badge">
                    {decodedContent.length} 字符
                  </span>
                  {#if viewTtlInfo}
                    <span
                      class="meta-badge ttl"
                      class:expired={viewTtlInfo.isExpired}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      {#if viewTtlInfo.isExpired}
                        已过期
                      {:else}
                        {formatRemainingTime(viewTtlInfo.remainingSeconds)}
                      {/if}
                    </span>
                  {/if}
                </div>
              </div>
              <div class="header-actions">
                <button class="btn" onclick={switchToCreate}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                  新建
                </button>
                <button class="btn btn-primary" onclick={copyContent}>
                  {#if copiedContent}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  {:else}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                      <path
                        d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"
                      />
                    </svg>
                    复制
                  {/if}
                </button>
              </div>
            </div>

            <!-- Content Body -->
            <div class="content-body">
              <div class="text-content">
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="markdown-body" onclick={handleMarkdownClick}>
                  {@html marked.parse(decodedContent)}
                </div>
              </div>
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <!-- Create Mode -->
      <section class="hero">
        <h1 class="hero-title">short</h1>
        <p class="hero-desc">
          无需服务器存储，文本直接编码在 URL 中<br />
          支持加密保护和过期时间设置
        </p>
      </section>

      <div class="editor-card card">
        <!-- Input Section -->
        <div class="editor-section">
          <div class="section-header">
            <label for="input-text" class="section-title">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                />
                <path
                  d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"
                />
              </svg>
              输入内容
            </label>
            <div class="section-actions">
              <span class="char-count">
                {charCount} 字符 · {byteCount} 字节
              </span>
              {#if inputText}
                <button
                  type="button"
                  class="btn btn-ghost btn-icon"
                  onclick={clear}
                  title="清空"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    style="pointer-events: none"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              {/if}
            </div>
          </div>
          <textarea
            id="input-text"
            class="editor-textarea"
            placeholder="在这里输入要分享的文本..."
            bind:value={inputText}
            spellcheck="false"
          ></textarea>
        </div>

        <!-- Options Section -->
        <div class="options-section">
          <!-- Password Option -->
          <div class="option-group">
            <label class="option-toggle">
              <input type="checkbox" bind:checked={enablePassword} />
              <span class="toggle-track">
                <span class="toggle-thumb"></span>
              </span>
              <span class="option-label">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                密码保护
              </span>
            </label>

            {#if enablePassword}
              <div class="option-inputs" transition:slide={{ duration: 150 }}>
                <input
                  type="password"
                  class="option-input"
                  placeholder="设置密码"
                  bind:value={password}
                />
                <input
                  type="password"
                  class="option-input"
                  placeholder="确认密码"
                  bind:value={confirmPassword}
                  class:error={password && confirmPassword && !passwordsMatch}
                />
                {#if password && confirmPassword && !passwordsMatch}
                  <span class="input-error">密码不匹配</span>
                {/if}
              </div>
            {/if}
          </div>

          <!-- TTL Option -->
          <div class="option-group">
            <label class="option-toggle">
              <input type="checkbox" bind:checked={enableTtl} />
              <span class="toggle-track">
                <span class="toggle-thumb"></span>
              </span>
              <span class="option-label">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                过期时间
              </span>
            </label>

            {#if enableTtl}
              <div
                class="option-inputs ttl-inputs"
                transition:slide={{ duration: 150 }}
              >
                <input
                  type="number"
                  class="option-input ttl-value"
                  min="1"
                  max="999"
                  bind:value={ttlValue}
                />
                <select class="option-select" bind:value={ttlUnit}>
                  <option value="minutes">分钟</option>
                  <option value="hours">小时</option>
                  <option value="days">天</option>
                </select>
              </div>
            {/if}
          </div>
        </div>

        <!-- Output Section -->
        {#if generatedLink || error}
          <div
            class="editor-section output-section"
            transition:slide={{ duration: 200 }}
          >
            <div class="section-header">
              <span class="section-title">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path
                    d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
                  />
                  <path
                    d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
                  />
                </svg>
                分享链接
              </span>
              {#if linkInfo}
                <div class="link-stats">
                  {#if linkInfo.isEncrypted}
                    <span class="badge badge-warning">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <rect
                          width="18"
                          height="11"
                          x="3"
                          y="11"
                          rx="2"
                          ry="2"
                        />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      加密
                    </span>
                  {/if}
                  {#if linkInfo.hasTtl}
                    <span class="badge badge-info">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      {ttlValue}{ttlUnit === 'minutes'
                        ? '分钟'
                        : ttlUnit === 'hours'
                          ? '小时'
                          : '天'}
                    </span>
                  {/if}
                  {#if linkInfo.isCompressed}
                    <span class="badge badge-success">已压缩</span>
                  {/if}
                  <span class="badge">
                    {generatedLink.length} 字符
                  </span>
                </div>
              {/if}
            </div>

            {#if error}
              <div class="error-box">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            {:else}
              <div class="link-box">
                <code class="link-text">{generatedLink}</code>
              </div>

              <!-- QR Code -->
              {#if showQrCode && qrCodeSvg}
                <div class="qr-container" transition:slide={{ duration: 200 }}>
                  <div class="qr-code">
                    {@html qrCodeSvg}
                  </div>
                  <p class="qr-hint">扫描二维码访问链接</p>
                </div>
              {/if}

              <div class="action-buttons">
                <button
                  class="btn btn-primary btn-icon"
                  onclick={copyLink}
                  title="复制链接"
                >
                  {#if copied}
                    <svg
                      transition:scale={{ duration: 200 }}
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  {:else}
                    <svg
                      transition:scale={{ duration: 200 }}
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                      <path
                        d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"
                      />
                    </svg>
                  {/if}
                </button>
                <button
                  class="btn btn-icon"
                  class:active={showQrCode}
                  onclick={() => (showQrCode = !showQrCode)}
                  title="显示二维码"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <rect width="5" height="5" x="3" y="3" rx="1" />
                    <rect width="5" height="5" x="16" y="3" rx="1" />
                    <rect width="5" height="5" x="3" y="16" rx="1" />
                    <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
                    <path d="M21 21v.01" />
                    <path d="M12 7v3a2 2 0 0 1-2 2H7" />
                    <path d="M3 12h.01" />
                    <path d="M12 3h.01" />
                    <path d="M12 16v.01" />
                    <path d="M16 12h1" />
                    <path d="M21 12v.01" />
                    <path d="M12 21v-1" />
                  </svg>
                  二维码
                </button>
                <button
                  class="btn btn-icon"
                  onclick={openPreview}
                  title="在新窗口打开"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path
                      d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
                    />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  预览
                </button>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Features -->
      <section class="features">
        <div class="feature">
          <div class="feature-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h3>客户端加密</h3>
          <p>使用 AES-GCM 加密，密码不离开浏览器</p>
        </div>
        <div class="feature">
          <div class="feature-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <h3>阅后即焚</h3>
          <p>设置过期时间，超时后自动失效</p>
        </div>
        <div class="feature">
          <div class="feature-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <h3>无需数据库</h3>
          <p>数据完全存储在 URL 中，无需信任第三方</p>
        </div>
      </section>

      {#if history.length > 0}
        <section class="history-section" transition:slide>
          <div class="history-header">
            <h2>History</h2>
            <button class="btn-text" onclick={clearHistory}>Clear</button>
          </div>
          <div class="history-list">
            {#each history as item}
              <button
                class="history-item"
                onclick={() => restoreFromHistory(item)}
              >
                <div class="history-content">{item.content}</div>
                <div class="history-meta">
                  <span class="history-date"
                    >{new Date(item.timestamp).toLocaleDateString()}</span
                  >
                  <div class="history-badges">
                    {#if item.isEncrypted}
                      <span class="mini-badge">🔒</span>
                    {/if}
                    {#if item.hasTtl}
                      <span class="mini-badge">⏱️</span>
                    {/if}
                  </div>
                </div>
              </button>
            {/each}
          </div>
        </section>
      {/if}
    {/if}
  </div>
</div>

<style>
  .page {
    padding: var(--spacing-xl) 0 var(--spacing-3xl);
    min-height: calc(100vh - 120px);
  }

  /* Hero */
  .hero {
    text-align: center;
    margin-bottom: var(--spacing-2xl);
  }

  .hero-title {
    font-size: 2.5rem;
    font-weight: 700;
    letter-spacing: -0.03em;
    margin-bottom: var(--spacing-sm);
  }

  .text-gradient {
    background: linear-gradient(135deg, var(--color-primary), #8b5cf6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .hero-desc {
    color: var(--color-text-secondary);
    font-size: 1rem;
    line-height: 1.7;
  }

  /* Editor Card */
  .editor-card {
    padding: 0;
    overflow: hidden;
  }

  .editor-section {
    padding: var(--spacing-lg);
  }

  .output-section {
    background: var(--color-bg-secondary);
    border-top: 1px solid var(--color-border);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-md);
    gap: var(--spacing-md);
    flex-wrap: wrap;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .section-actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .char-count {
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
    font-family: var(--font-mono);
  }

  .editor-textarea {
    width: 100%;
    min-height: 160px;
    padding: var(--spacing-md);
    font-family: var(--font-mono);
    font-size: 0.9rem;
    line-height: 1.6;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg);
    resize: vertical;
  }

  .editor-textarea:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-dim);
  }

  /* Options Section */
  .options-section {
    padding: var(--spacing-md) var(--spacing-lg);
    border-top: 1px solid var(--color-border);
    display: flex;
    gap: var(--spacing-xl);
    flex-wrap: wrap;
    background: var(--color-bg-secondary);
  }

  .option-group {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .option-toggle {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    cursor: pointer;
    user-select: none;
  }

  .option-toggle input {
    display: none;
  }

  .toggle-track {
    width: 36px;
    height: 20px;
    background: var(--color-border);
    border-radius: 10px;
    position: relative;
    transition: background var(--transition-fast);
  }

  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    background: white;
    border-radius: 50%;
    transition: transform var(--transition-fast);
  }

  .option-toggle input:checked + .toggle-track {
    background: var(--color-primary);
  }

  .option-toggle input:checked + .toggle-track .toggle-thumb {
    transform: translateX(16px);
  }

  .option-label {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .option-inputs {
    display: flex;
    gap: var(--spacing-sm);
    flex-wrap: wrap;
  }

  .option-input {
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: 0.875rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg);
    width: 140px;
  }

  .option-input:focus {
    border-color: var(--color-primary);
    outline: none;
  }

  .option-input.error {
    border-color: var(--color-error);
  }

  .input-error {
    font-size: 0.75rem;
    color: var(--color-error);
    width: 100%;
  }

  .ttl-inputs {
    align-items: center;
  }

  .ttl-value {
    width: 80px;
  }

  .option-select {
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: 0.875rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg);
    color: var(--color-text);
    cursor: pointer;
  }

  /* Link Output */
  .link-stats {
    display: flex;
    gap: var(--spacing-xs);
    flex-wrap: wrap;
  }

  .badge-warning {
    background: var(--color-bg-tertiary);
    color: var(--color-text);
  }

  .badge-info {
    background: var(--color-bg-tertiary);
    color: var(--color-text);
  }

  .badge-success {
    background: var(--color-bg-tertiary);
    color: var(--color-text);
  }

  .badge svg {
    flex-shrink: 0;
  }

  .link-box {
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--spacing-md);
    margin-bottom: var(--spacing-md);
    overflow: hidden;
  }

  .link-text {
    display: block;
    font-size: 0.8rem;
    word-break: break-all;
    color: var(--color-text-secondary);
    background: transparent;
    padding: 0;
  }

  .error-box {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text);
    font-size: 0.875rem;
  }

  /* QR Code */
  .qr-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--spacing-lg);
    margin-bottom: var(--spacing-md);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }

  .qr-code {
    width: 200px;
    height: 200px;
    color: var(--color-text);
  }

  .qr-code :global(svg) {
    width: 100%;
    height: 100%;
  }

  .qr-hint {
    margin-top: var(--spacing-sm);
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
  }

  .action-buttons {
    display: flex;
    gap: var(--spacing-sm);
    flex-wrap: wrap;
  }

  .action-buttons .btn {
    flex: 1;
    min-width: 100px;
  }

  .btn.active {
    background: var(--color-primary-dim);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  /* Features */
  .features {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--spacing-lg);
    margin-top: var(--spacing-3xl);
  }

  .feature {
    text-align: center;
    padding: var(--spacing-lg);
  }

  .feature-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: var(--color-primary-dim);
    color: var(--color-primary);
    border-radius: var(--radius-lg);
    margin-bottom: var(--spacing-md);
  }

  .feature h3 {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: var(--spacing-xs);
  }

  .feature p {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    line-height: 1.5;
  }

  /* View Mode */
  .view-mode {
    padding-top: var(--spacing-lg);
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-3xl);
    color: var(--color-text-secondary);
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: var(--spacing-md);
  }

  .btn-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Password Card */
  .password-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--spacing-3xl);
    text-align: center;
  }

  .password-icon {
    color: var(--color-primary);
    margin-bottom: var(--spacing-lg);
  }

  .password-card h2 {
    font-size: 1.5rem;
    margin-bottom: var(--spacing-sm);
  }

  .password-hint {
    color: var(--color-text-secondary);
    margin-bottom: var(--spacing-lg);
  }

  .ttl-badge {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--color-primary-dim);
    color: var(--color-primary);
    border-radius: var(--radius-full);
    font-size: 0.75rem;
    font-weight: 500;
    margin-bottom: var(--spacing-lg);
  }

  .ttl-badge.expired {
    background: var(--color-bg-tertiary);
    color: var(--color-text);
    text-decoration: line-through;
  }

  .password-form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    width: 100%;
    max-width: 280px;
  }

  .password-input {
    padding: var(--spacing-md);
    font-size: 1rem;
    text-align: center;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg);
  }

  .password-input:focus {
    border-color: var(--color-primary);
    outline: none;
    box-shadow: 0 0 0 3px var(--color-primary-dim);
  }

  .password-error {
    color: var(--color-error);
    font-size: 0.875rem;
    margin-top: var(--spacing-sm);
  }

  /* Error Card */
  .error-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-3xl);
    text-align: center;
  }

  .error-icon {
    color: var(--color-error);
    margin-bottom: var(--spacing-lg);
    opacity: 0.8;
  }

  .error-card h2 {
    font-size: 1.5rem;
    margin-bottom: var(--spacing-sm);
  }

  .error-message {
    color: var(--color-text-secondary);
    margin-bottom: var(--spacing-xl);
  }

  /* Content Card */
  .content-card {
    overflow: hidden;
  }

  .content-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-lg);
    border-bottom: 1px solid var(--color-border);
    gap: var(--spacing-md);
    flex-wrap: wrap;
  }

  .header-left {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .content-title {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    font-size: 1.125rem;
    font-weight: 600;
  }

  .title-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: var(--color-bg-tertiary);
    color: var(--color-text);
    border-radius: var(--radius-md);
  }

  .content-badges {
    display: flex;
    gap: var(--spacing-sm);
    flex-wrap: wrap;
  }

  .meta-badge {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: 0.125rem 0.5rem;
    font-size: 0.7rem;
    font-family: var(--font-mono);
    background: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
    border-radius: var(--radius-full);
  }

  .meta-badge.ttl {
    background: var(--color-bg-tertiary);
    color: var(--color-text);
  }

  .meta-badge.ttl.expired {
    background: var(--color-bg-tertiary);
    color: var(--color-text);
    text-decoration: line-through;
  }

  .header-actions {
    display: flex;
    gap: var(--spacing-sm);
  }

  .content-body {
    padding: var(--spacing-lg);
    min-height: 200px;
    max-height: 60vh;
    overflow: auto;
  }

  .text-content {
    font-size: 1rem;
    line-height: 1.8;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .text-content :global(.content-link) {
    color: var(--color-primary);
    text-decoration: underline;
    text-underline-offset: 2px;
    transition: opacity var(--transition-fast);
  }

  .text-content :global(.content-link:hover) {
    opacity: 0.7;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .hero-title {
      font-size: 2rem;
    }

    .features {
      grid-template-columns: 1fr;
      gap: var(--spacing-md);
    }

    .feature {
      padding: var(--spacing-md);
    }

    .options-section {
      flex-direction: column;
      gap: var(--spacing-md);
    }
  }

  @media (max-width: 480px) {
    .section-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .action-buttons {
      flex-direction: column;
    }

    .action-buttons .btn {
      width: 100%;
    }

    .content-header {
      flex-direction: column;
      align-items: stretch;
    }

    .header-actions {
      justify-content: stretch;
    }

    .header-actions .btn {
      flex: 1;
    }

    .option-input {
      width: 100%;
    }

    .link-stats {
      justify-content: flex-start;
    }
  }

  /* Markdown Styles */
  .markdown-body {
    font-size: 1rem;
    line-height: 1.6;
    color: var(--text-primary);
    text-align: left;
    word-wrap: break-word;
  }
  .markdown-body :global(h1),
  .markdown-body :global(h2),
  .markdown-body :global(h3),
  .markdown-body :global(h4),
  .markdown-body :global(h5),
  .markdown-body :global(h6) {
    margin-top: 1.5em;
    margin-bottom: 0.5em;
    font-weight: 600;
    color: var(--text-primary);
    line-height: 1.25;
  }
  .markdown-body :global(h1) {
    font-size: 1.8em;
    border-bottom: 1px solid var(--bg-tertiary);
    padding-bottom: 0.3em;
  }
  .markdown-body :global(h2) {
    font-size: 1.5em;
    border-bottom: 1px solid var(--bg-tertiary);
    padding-bottom: 0.3em;
  }
  .markdown-body :global(p) {
    margin-bottom: 1em;
  }
  .markdown-body :global(code) {
    background: var(--bg-tertiary);
    padding: 0.2em 0.4em;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.9em;
  }
  .markdown-body :global(.code-block-wrapper) {
    position: relative;
    margin-bottom: 1em;
  }

  .markdown-body :global(.copy-code-btn) {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    opacity: 0;
    z-index: 10;
  }

  .markdown-body :global(.code-block-wrapper:hover .copy-code-btn) {
    opacity: 1;
  }

  .markdown-body :global(.copy-code-btn:hover) {
    background: var(--color-bg-tertiary);
    color: var(--color-text);
  }

  .markdown-body :global(pre) {
    background: var(--color-bg-secondary);
    padding: 1em;
    padding-top: 2.5em;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    overflow-x: auto;
    margin: 0;
  }
  .markdown-body :global(pre code) {
    background: transparent;
    padding: 0;
    color: inherit;
    font-size: 0.9em;
    filter: grayscale(100%);
  }
  .markdown-body :global(blockquote) {
    border-left: 4px solid var(--color-primary);
    margin: 0 0 1em 0;
    padding: 0 1em;
    color: var(--color-text-secondary);
  }
  .markdown-body :global(a) {
    color: var(--color-primary);
    text-decoration: none;
  }
  .markdown-body :global(a:hover) {
    text-decoration: underline;
  }
  .markdown-body :global(ul),
  .markdown-body :global(ol) {
    padding-left: 1.5em;
    margin-bottom: 1em;
  }
  .markdown-body :global(li) {
    margin-bottom: 0.3em;
  }
  .markdown-body :global(img) {
    max-width: 100%;
    border-radius: 8px;
  }
  .markdown-body :global(hr) {
    height: 2px;
    padding: 0;
    margin: 24px 0;
    background-color: var(--bg-tertiary);
    border: 0;
  }

  /* History Styles */
  .history-section {
    max-width: 800px;
    margin: 3rem auto 2rem;
    width: 100%;
    padding: 0 1rem;
    box-sizing: border-box;
  }
  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }
  .history-header h2 {
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin: 0;
  }
  .btn-text {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.9rem;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    transition: all 0.2s;
  }
  .btn-text:hover {
    color: var(--primary);
    background: var(--bg-secondary);
  }
  .history-list {
    display: grid;
    gap: 0.75rem;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  }
  .history-item {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1rem;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
    position: relative;
    overflow: hidden;
  }
  .history-item:hover {
    transform: translateY(-3px);
    border-color: var(--primary);
    box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.2);
  }
  .history-content {
    font-size: 0.95rem;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
  }
  .history-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }
  .history-badges {
    display: flex;
    gap: 0.5rem;
  }
  .mini-badge {
    font-size: 0.9rem;
    opacity: 0.8;
  }
  /* Markdown Styles */
  .markdown-body {
    font-size: 1rem;
    line-height: 1.6;
    color: var(--color-text);
    text-align: left;
    word-wrap: break-word;
  }

  .markdown-body :global(h1),
  .markdown-body :global(h2),
  .markdown-body :global(h3),
  .markdown-body :global(h4),
  .markdown-body :global(h5),
  .markdown-body :global(h6) {
    margin-top: 1.5em;
    margin-bottom: 0.5em;
    font-weight: 600;
    color: var(--color-text);
    line-height: 1.25;
  }

  :global(.btn-primary) {
    color: var(--color-bg) !important;
  }

  .markdown-body :global(h1) {
    font-size: 1.8em;
    border-bottom: 1px solid var(--bg-tertiary);
    padding-bottom: 0.3em;
  }
  .markdown-body :global(h2) {
    font-size: 1.5em;
    border-bottom: 1px solid var(--bg-tertiary);
    padding-bottom: 0.3em;
  }
  .markdown-body :global(p) {
    margin-bottom: 1em;
  }
  .markdown-body :global(code) {
    background: var(--bg-tertiary);
    padding: 0.2em 0.4em;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.9em;
  }
  .markdown-body :global(pre) {
    background: #282c34; /* Atom One Dark bg */
    padding: 1em;
    border-radius: 8px;
    overflow-x: auto;
    margin-bottom: 1em;
  }
  .markdown-body :global(pre code) {
    background: transparent;
    padding: 0;
    color: inherit;
    font-size: 0.9em;
  }
  .markdown-body :global(blockquote) {
    border-left: 4px solid var(--primary);
    margin: 0 0 1em 0;
    padding: 0 1em;
    color: var(--text-secondary);
  }
  .markdown-body :global(a) {
    color: var(--primary);
    text-decoration: none;
  }
  .markdown-body :global(a:hover) {
    text-decoration: underline;
  }
  .markdown-body :global(ul),
  .markdown-body :global(ol) {
    padding-left: 1.5em;
    margin-bottom: 1em;
  }
  .markdown-body :global(li) {
    margin-bottom: 0.3em;
  }
  .markdown-body :global(img) {
    max-width: 100%;
    border-radius: 8px;
  }
  .markdown-body :global(hr) {
    height: 2px;
    padding: 0;
    margin: 24px 0;
    background-color: var(--bg-tertiary);
    border: 0;
  }

  /* History Styles */
  .history-section {
    max-width: 800px;
    margin: 3rem auto 2rem;
    width: 100%;
    padding: 0 1rem;
    box-sizing: border-box;
  }
  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }
  .history-header h2 {
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin: 0;
  }
  .btn-text {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.9rem;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    transition: all 0.2s;
  }
  .btn-text:hover {
    color: var(--primary);
    background: var(--bg-secondary);
  }
  .history-list {
    display: grid;
    gap: 0.75rem;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  }
  .history-item {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1rem;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
    position: relative;
    overflow: hidden;
  }
  .history-item:hover {
    transform: translateY(-3px);
    border-color: var(--primary);
    box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.2);
  }
  .history-content {
    font-size: 0.95rem;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
  }
  .history-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }
  .history-badges {
    display: flex;
    gap: 0.5rem;
  }
  .mini-badge {
    font-size: 0.9rem;
    opacity: 0.8;
  }
  /* Markdown Styles */
  .markdown-body {
    font-size: 1rem;
    line-height: 1.6;
    color: var(--text-primary);
    text-align: left;
    word-wrap: break-word;
  }
  .markdown-body :global(h1),
  .markdown-body :global(h2),
  .markdown-body :global(h3),
  .markdown-body :global(h4),
  .markdown-body :global(h5),
  .markdown-body :global(h6) {
    margin-top: 1.5em;
    margin-bottom: 0.5em;
    font-weight: 600;
    color: var(--text-primary);
    line-height: 1.25;
  }
  .markdown-body :global(h1) {
    font-size: 1.8em;
    border-bottom: 1px solid var(--bg-tertiary);
    padding-bottom: 0.3em;
  }
  .markdown-body :global(h2) {
    font-size: 1.5em;
    border-bottom: 1px solid var(--bg-tertiary);
    padding-bottom: 0.3em;
  }
  .markdown-body :global(p) {
    margin-bottom: 1em;
  }
  .markdown-body :global(code) {
    background: var(--bg-tertiary);
    padding: 0.2em 0.4em;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.9em;
  }
  .markdown-body :global(pre) {
    background: #282c34; /* Atom One Dark bg */
    padding: 1em;
    border-radius: 8px;
    overflow-x: auto;
    margin-bottom: 1em;
  }
  .markdown-body :global(pre code) {
    background: transparent;
    padding: 0;
    color: inherit;
    font-size: 0.9em;
  }
  .markdown-body :global(blockquote) {
    border-left: 4px solid var(--primary);
    margin: 0 0 1em 0;
    padding: 0 1em;
    color: var(--text-secondary);
  }
  .markdown-body :global(a) {
    color: var(--primary);
    text-decoration: none;
  }
  .markdown-body :global(a:hover) {
    text-decoration: underline;
  }
  .markdown-body :global(ul),
  .markdown-body :global(ol) {
    padding-left: 1.5em;
    margin-bottom: 1em;
  }
  .markdown-body :global(li) {
    margin-bottom: 0.3em;
  }
  .markdown-body :global(img) {
    max-width: 100%;
    border-radius: 8px;
  }
  .markdown-body :global(hr) {
    height: 2px;
    padding: 0;
    margin: 24px 0;
    background-color: var(--bg-tertiary);
    border: 0;
  }

  /* History Styles */
  .history-section {
    max-width: 800px;
    margin: 3rem auto 2rem;
    width: 100%;
    padding: 0 1rem;
    box-sizing: border-box;
  }
  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }
  .history-header h2 {
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin: 0;
  }
  .btn-text {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.9rem;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    transition: all 0.2s;
  }
  .btn-text:hover {
    color: var(--primary);
    background: var(--bg-secondary);
  }
  .history-list {
    display: grid;
    gap: 0.75rem;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  }
  .history-item {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1rem;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
    position: relative;
    overflow: hidden;
  }
  .history-item:hover {
    transform: translateY(-3px);
    border-color: var(--primary);
    box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.2);
  }
  .history-content {
    font-size: 0.95rem;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
  }
  .history-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }
  .history-badges {
    display: flex;
    gap: 0.5rem;
  }
  .mini-badge {
    font-size: 0.9rem;
    opacity: 0.8;
  }
</style>
