# 顶部右侧插槽

`AdminLayout` 和 `Header` 提供相同的具名插槽。纵向、横向布局和移动端都支持；不传插槽时保留原有按钮、功能开关与用户菜单。

| 插槽 | 作用 |
| --- | --- |
| `header-right` | 替换整个右侧区域，包含默认按钮与用户菜单 |
| `header-right-before` | 在默认搜索按钮之前追加内容 |
| `header-right-after` | 在默认用户菜单之后追加内容 |
| `header-user` | 单独替换用户头像及下拉菜单，保留其他功能按钮 |

所有插槽均提供以下参数，TypeScript 类型见 `src/types/layoutSlots.ts`：

- `isMobile: boolean`：当前是否为移动端，可据此精简自定义内容。
- `openSearch: () => void`：打开全局搜索，遵守 `features.search` 开关。
- `openSettings: () => void`：打开个性化配置，遵守 `features.personalization` 开关。

`header-right` 是完整替换，其内容生效时不会同时渲染另外三个插槽。仅追加内容时使用 before/after 插槽；它们不会影响默认按钮。插槽是 Vue 组件接口，不写入 `settings.ts` 或浏览器缓存。既有 `features` 配置继续控制内置功能，自定义业务按钮的显隐由使用方决定。

## 追加业务按钮

在应用中封装一个布局组件，例如 `src/layouts/AppLayout.vue`：

```vue
<template>
  <AdminLayout>
    <template #header-right-before="{ isMobile }">
      <a-button type="text" @click="openHelp">
        {{ isMobile ? '帮助' : '帮助中心' }}
      </a-button>
    </template>
    <template #header-right-after="{ isMobile }">
      <a-tag v-if="!isMobile">内部工作台</a-tag>
    </template>
  </AdminLayout>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import AdminLayout from '@/components/Layout/AdminLayout.vue';

const router = useRouter();
function openHelp(): void {
  // 替换成项目已有的业务路由。
  void router.push('/about');
}
</script>
```

然后将 `src/router/routes.ts` 中需要扩展的布局路由的 `component` 指向这个封装组件，保留其 `children` 配置。`AdminLayout` 未接收 default 插槽时仍渲染原来的子路由，无需在封装组件里再放一个 `router-view`。

## 替换右侧内容

```vue
<AdminLayout>
  <template #header-right="{ isMobile, openSearch, openSettings }">
    <a-space :size="isMobile ? 4 : 12">
      <a-button type="text" @click="openSearch">搜索</a-button>
      <a-button type="text" @click="openSettings">偏好设置</a-button>
      <BusinessUserMenu />
    </a-space>
  </template>
</AdminLayout>
```

完整替换后默认用户菜单不会自动出现，需要在自定义内容中提供个人中心、退出等所需操作。示例中的打开方法即使被自定义按钮调用，也不会启用代码中已关闭的模块；如需同时隐藏该按钮，可自行读取 `useSettingsStore().features`。

只替换头像区域则使用：

```vue
<AdminLayout>
  <template #header-user="{ isMobile }">
    <BusinessUserMenu :compact="isMobile" />
  </template>
</AdminLayout>
```

自定义内容直接进入现有的 flex 右侧容器，多按钮可用 `a-space` 统一间距。移动端应使用图标或简短文字，避免固定宽度较大的内容挤压导航。页面全屏模式继续隐藏整个顶部区域。
