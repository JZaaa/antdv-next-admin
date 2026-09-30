import { defineAsyncComponent, type Component } from 'vue';
import VxeUI from 'vxe-pc-ui/es/ui';

// Preserve the complete VXE registry, loading non-table controls only when used.
// Explicit imports let Vite produce chunks for the pinned vxe-pc-ui 4.18.9 release.
/**
 * 为尚未注册的可选 VXE 控件注册异步组件，首次使用时加载并复用已有注册项。
 * @returns void。
 */
export function registerOptionalVxeComponents(): void {
  const loaders = {
    VxeAlert: () => import('vxe-pc-ui/es/alert').then((module) => module.default),
    VxeAnchor: () => import('vxe-pc-ui/es/anchor').then((module) => module.default),
    VxeAnchorLink: () => import('vxe-pc-ui/es/anchor-link').then((module) => module.default),
    VxeAvatar: () => import('vxe-pc-ui/es/avatar').then((module) => module.default),
    VxeBacktop: () => import('vxe-pc-ui/es/backtop').then((module) => module.default),
    VxeBadge: () => import('vxe-pc-ui/es/badge').then((module) => module.default),
    VxeBreadcrumb: () => import('vxe-pc-ui/es/breadcrumb').then((module) => module.default),
    VxeBreadcrumbItem: () =>
      import('vxe-pc-ui/es/breadcrumb-item').then((module) => module.default),
    VxeButtonGroup: () => import('vxe-pc-ui/es/button-group').then((module) => module.default),
    VxeCalendar: () => import('vxe-pc-ui/es/calendar').then((module) => module.default),
    VxeCard: () => import('vxe-pc-ui/es/card').then((module) => module.default),
    VxeCarousel: () => import('vxe-pc-ui/es/carousel').then((module) => module.default),
    VxeCarouselItem: () => import('vxe-pc-ui/es/carousel-item').then((module) => module.default),
    VxeCascader: () => import('vxe-pc-ui/es/cascader').then((module) => module.default),
    VxeCheckboxButton: () =>
      import('vxe-pc-ui/es/checkbox-button').then((module) => module.default),
    VxeCol: () => import('vxe-pc-ui/es/col').then((module) => module.default),
    VxeCollapse: () => import('vxe-pc-ui/es/collapse').then((module) => module.default),
    VxeCollapsePane: () => import('vxe-pc-ui/es/collapse-pane').then((module) => module.default),
    VxeCountdown: () => import('vxe-pc-ui/es/countdown').then((module) => module.default),
    VxeDatePanel: () => import('vxe-pc-ui/es/date-panel').then((module) => module.default),
    VxeDatePicker: () => import('vxe-pc-ui/es/date-picker').then((module) => module.default),
    VxeDateRangePicker: () =>
      import('vxe-pc-ui/es/date-range-picker').then((module) => module.default),
    VxeDivider: () => import('vxe-pc-ui/es/divider').then((module) => module.default),
    VxeEmpty: () => import('vxe-pc-ui/es/empty').then((module) => module.default),
    VxeFormGather: () => import('vxe-pc-ui/es/form-gather').then((module) => module.default),
    VxeFormGroup: () => import('vxe-pc-ui/es/form-group').then((module) => module.default),
    VxeIconPicker: () => import('vxe-pc-ui/es/icon-picker').then((module) => module.default),
    VxeImage: () => import('vxe-pc-ui/es/image').then((module) => module.default),
    VxeImageGroup: () => import('vxe-pc-ui/es/image-group').then((module) => module.default),
    VxeLayoutAside: () => import('vxe-pc-ui/es/layout-aside').then((module) => module.default),
    VxeLayoutBody: () => import('vxe-pc-ui/es/layout-body').then((module) => module.default),
    VxeLayoutContainer: () =>
      import('vxe-pc-ui/es/layout-container').then((module) => module.default),
    VxeLayoutFooter: () => import('vxe-pc-ui/es/layout-footer').then((module) => module.default),
    VxeLayoutHeader: () => import('vxe-pc-ui/es/layout-header').then((module) => module.default),
    VxeLink: () => import('vxe-pc-ui/es/link').then((module) => module.default),
    VxeList: () => import('vxe-pc-ui/es/list').then((module) => module.default),
    VxeMenu: () => import('vxe-pc-ui/es/menu').then((module) => module.default),
    VxeNoticeBar: () => import('vxe-pc-ui/es/notice-bar').then((module) => module.default),
    VxePasswordInput: () => import('vxe-pc-ui/es/password-input').then((module) => module.default),
    VxePrintPageBreak: () =>
      import('vxe-pc-ui/es/print-page-break').then((module) => module.default),
    VxePulldown: () => import('vxe-pc-ui/es/pulldown').then((module) => module.default),
    VxeRadioButton: () => import('vxe-pc-ui/es/radio-button').then((module) => module.default),
    VxeRate: () => import('vxe-pc-ui/es/rate').then((module) => module.default),
    VxeResult: () => import('vxe-pc-ui/es/result').then((module) => module.default),
    VxeRow: () => import('vxe-pc-ui/es/row').then((module) => module.default),
    VxeSegmented: () => import('vxe-pc-ui/es/segmented').then((module) => module.default),
    VxeSplitter: () => import('vxe-pc-ui/es/splitter').then((module) => module.default),
    VxeSplitterPanel: () => import('vxe-pc-ui/es/splitter-panel').then((module) => module.default),
    VxeSplit: () => import('vxe-pc-ui/es/split').then((module) => module.default),
    VxeSplitPane: () => import('vxe-pc-ui/es/split-pane').then((module) => module.default),
    VxeSlider: () => import('vxe-pc-ui/es/slider').then((module) => module.default),
    VxeSpace: () => import('vxe-pc-ui/es/space').then((module) => module.default),
    VxeSteps: () => import('vxe-pc-ui/es/steps').then((module) => module.default),
    VxeTabPane: () => import('vxe-pc-ui/es/tab-pane').then((module) => module.default),
    VxeTableSelect: () => import('vxe-pc-ui/es/table-select').then((module) => module.default),
    VxeTableTransfer: () => import('vxe-pc-ui/es/table-transfer').then((module) => module.default),
    VxeTabs: () => import('vxe-pc-ui/es/tabs').then((module) => module.default),
    VxeTag: () => import('vxe-pc-ui/es/tag').then((module) => module.default),
    VxeTextEllipsis: () => import('vxe-pc-ui/es/text-ellipsis').then((module) => module.default),
    VxeText: () => import('vxe-pc-ui/es/text').then((module) => module.default),
    VxeTextarea: () => import('vxe-pc-ui/es/textarea').then((module) => module.default),
    VxeTimeline: () => import('vxe-pc-ui/es/timeline').then((module) => module.default),
    VxeTimelineItem: () => import('vxe-pc-ui/es/timeline-item').then((module) => module.default),
    VxeTip: () => import('vxe-pc-ui/es/tip').then((module) => module.default),
    VxeTour: () => import('vxe-pc-ui/es/tour').then((module) => module.default),
    VxeTransfer: () => import('vxe-pc-ui/es/transfer').then((module) => module.default),
    VxeTree: () => import('vxe-pc-ui/es/tree').then((module) => module.default),
    VxeTreeSelect: () => import('vxe-pc-ui/es/tree-select').then((module) => module.default),
  };
  for (const name of Object.keys(loaders) as Array<keyof typeof loaders>) {
    if (!VxeUI.getComponent(name))
      VxeUI.component(Object.assign(defineAsyncComponent<Component>(loaders[name]), { name }));
  }
}
