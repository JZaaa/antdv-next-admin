export type IconCollectionMode = 'off' | 'used' | 'all';

export interface IconBuildConfig {
  collections: Record<'ri' | 'mdi' | 'ion', IconCollectionMode>;
  antd: IconCollectionMode;
  /** Backend-provided or computed icon names that cannot be found as source literals. */
  safelist: string[];
  online: boolean;
}

const iconConfig: IconBuildConfig = {
  // all：整库打包、选择器可选；used：源码完整名称 + safelist；off：不打包、不提供分类。
  // 当前示例用到了三个库，默认保留。关闭某个库时需要一并移除源码中的引用。
  collections: { ri: 'all', mdi: 'all', ion: 'all' },
  // 只控制字符串名称的动态图标；直接 import 的 Antdv 组件仍由构建工具按需处理。
  antd: 'all',
  // used 模式下后端返回或动态拼接的名称，例如 ['mdi:account', 'antd:EditOutlined']。
  safelist: [],
  // 默认只访问部署站点；在线功能还需组件显式开启 allowOnline / enableOnlineSearch。
  online: false,
};

export default iconConfig;
