<script lang="ts">
  import '../app.css'

  let { children } = $props()
</script>

<svelte:head>
  <title>Short - URL Clipboard</title>
</svelte:head>

<div class="layout">
  <header class="header">
    <div class="container header-inner">
      <a href="/" class="logo">
        <span class="logo-text">s.dogxi.me</span>
      </a>

      <nav class="nav">
        <a
          href="https://github.com/dogxii/dxcode"
          target="_blank"
          rel="noopener noreferrer"
          class="nav-link"
          aria-label="GitHub"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"
            />
            <path d="M9 18c-4.51 2-5-2-7-2" />
          </svg>
        </a>
      </nav>
    </div>
  </header>

  <main class="main">
    {@render children()}
  </main>

  <footer class="footer">
    <div class="container footer-inner">
      <span class="footer-text">
        Built by <a href="https://blog.dogxi.me" target="_blank">Dogxi</a>
      </span>
      <span class="footer-divider">·</span>
      <span class="footer-text text-tertiary">No server, pure URL magic</span>
    </div>
  </footer>
</div>

<style>
  .layout {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  .header {
    position: sticky;
    top: 0;
    z-index: 50;
    background: var(--color-bg);
    border-bottom: 1px solid var(--color-border);
    backdrop-filter: blur(8px);
  }

  .header-inner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 56px;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    font-weight: 600;
    font-size: 1.125rem;
    color: var(--color-text);
    text-decoration: none;
  }

  .logo:hover {
    color: var(--color-text);
  }

  .logo-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: var(--color-primary);
    color: white;
    border-radius: var(--radius-md);
  }

  .logo-text {
    letter-spacing: -0.02em;
  }

  .nav {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .nav-link {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    color: var(--color-text-secondary);
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
  }

  .nav-link:hover {
    color: var(--color-text);
    background: var(--color-bg-tertiary);
  }

  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .footer {
    border-top: 1px solid var(--color-border);
    padding: var(--spacing-lg) 0;
  }

  .footer-inner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  .footer-text a {
    color: var(--color-text-secondary);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .footer-text a:hover {
    color: var(--color-text);
  }

  .footer-divider {
    color: var(--color-text-tertiary);
  }

  @media (max-width: 640px) {
    .footer-inner {
      flex-direction: column;
      gap: var(--spacing-xs);
    }

    .footer-divider {
      display: none;
    }
  }
</style>
