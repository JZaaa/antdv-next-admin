<template>
  <a-modal
    :open="noticeOpen"
    :title="$t('updateCheck.title')"
    :ok-text="$t('updateCheck.refresh')"
    :cancel-text="$t('updateCheck.later')"
    :closable="false"
    :mask-closable="false"
    :keyboard="false"
    @ok="refreshPage"
    @cancel="closeNotice"
  >
    <p>{{ $t('updateCheck.description') }}</p>
  </a-modal>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

interface Props {
  /** 检查间隔，单位为分钟；小于等于零时不启用检测。 */
  intervalMinutes: number;
}

const props = defineProps<Props>();
const noticeOpen = ref(false);

let active = false;
let isChecking = false;
let lastVersionTag = '';
let timer: ReturnType<typeof setInterval> | undefined;

/**
 * 获取部署入口的缓存标识，开发模式及请求失败时跳过本次检测。
 * @returns ETag 或 Last-Modified；无法取得时返回 null。
 */
async function getVersionTag(): Promise<string | null> {
  if (import.meta.env.DEV) return null;

  try {
    const response = await fetch(`${import.meta.env.BASE_URL}index.html`, {
      cache: 'no-cache',
      method: 'HEAD',
      redirect: 'manual',
    });
    if (!response.ok) return null;

    return response.headers.get('etag') || response.headers.get('last-modified');
  } catch {
    return null;
  }
}

/**
 * 比较本次与首次取得的入口标识，发现变化后停止轮询并提示刷新。
 * @returns 检测完成；失败或页面隐藏时不更改版本基线。
 */
async function checkForUpdates(): Promise<void> {
  if (!active || document.hidden || isChecking || noticeOpen.value || props.intervalMinutes <= 0)
    return;

  isChecking = true;
  try {
    const versionTag = await getVersionTag();
    if (!active || document.hidden || !versionTag) return;

    if (!lastVersionTag) {
      lastVersionTag = versionTag;
      return;
    }

    if (lastVersionTag !== versionTag) {
      stop();
      noticeOpen.value = true;
    }
  } finally {
    isChecking = false;
  }
}

/** 按配置启动可见页面的定时检测，避免重复创建计时器。@returns 无返回值。 */
function start(): void {
  if (!active || document.hidden || noticeOpen.value || timer || props.intervalMinutes <= 0) return;

  timer = setInterval(
    () => {
      void checkForUpdates();
    },
    props.intervalMinutes * 60 * 1000,
  );
}

/** 停止当前定时检测。@returns 无返回值。 */
function stop(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = undefined;
}

/**
 * 页面隐藏时暂停检测，重新可见时立即检查并恢复轮询。
 * @returns 无返回值。
 */
function handleVisibilityChange(): void {
  if (document.hidden) {
    stop();
    return;
  }

  void checkForUpdates().finally(() => {
    start();
  });
}

/** 用户确认后重新加载整页。@returns 无返回值。 */
function refreshPage(): void {
  window.location.reload();
}

/** 用户选择稍后刷新时关闭本次提示。@returns 无返回值。 */
function closeNotice(): void {
  noticeOpen.value = false;
}

/** 注册更新检测并等待首次轮询。@returns 无返回值。 */
onMounted(() => {
  active = true;
  start();
  document.addEventListener('visibilitychange', handleVisibilityChange);
});

/** 组件卸载时清理计时器与事件监听。@returns 无返回值。 */
onUnmounted(() => {
  active = false;
  stop();
  document.removeEventListener('visibilitychange', handleVisibilityChange);
});
</script>
