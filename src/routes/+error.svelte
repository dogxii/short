<script lang="ts">
  import { page } from '$app/stores'
</script>

<div class="error-page">
  <div class="container">
    <div class="error-content">
      <h1 class="error-code">{$page.status}</h1>
      <p class="error-message">
        {#if $page.status === 404}
          页面未找到
        {:else if $page.status === 500}
          服务器错误
        {:else}
          {$page.error?.message || '发生了错误'}
        {/if}
      </p>
      <a href="/" class="btn btn-primary">返回首页</a>
    </div>
  </div>
</div>

<style>
  .error-page {
    min-height: calc(100vh - 120px);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .error-content {
    text-align: center;
  }

  .error-code {
    font-size: 6rem;
    font-weight: 700;
    color: var(--color-text-tertiary);
    line-height: 1;
    margin-bottom: var(--spacing-md);
  }

  .error-message {
    font-size: 1.25rem;
    color: var(--color-text-secondary);
    margin-bottom: var(--spacing-xl);
  }

  @media (max-width: 640px) {
    .error-code {
      font-size: 4rem;
    }

    .error-message {
      font-size: 1rem;
    }
  }
</style>
