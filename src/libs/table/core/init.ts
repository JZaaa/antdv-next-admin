import type { TableLocale, TableSetupOptions } from '../types';

import { isRef, shallowRef, watch } from 'vue';
import { VxeButton } from 'vxe-pc-ui/es/button';
import { VxeCheckbox } from 'vxe-pc-ui/es/checkbox';
import { VxeCheckboxGroup } from 'vxe-pc-ui/es/checkbox-group';
import { VxeColorPicker } from 'vxe-pc-ui/es/color-picker';
import { VxeContextMenu } from 'vxe-pc-ui/es/context-menu';
import { VxeDrawer } from 'vxe-pc-ui/es/drawer';
import { VxeForm } from 'vxe-pc-ui/es/form';
import { VxeFormItem } from 'vxe-pc-ui/es/form-item';
import { VxeIcon } from 'vxe-pc-ui/es/icon';
import { VxeImagePreview } from 'vxe-pc-ui/es/image-preview';
import { VxeInput } from 'vxe-pc-ui/es/input';
import enUS from 'vxe-pc-ui/es/language/en-US';
import zhCN from 'vxe-pc-ui/es/language/zh-CN';
import { VxeLoading } from 'vxe-pc-ui/es/loading';
import { VxeModal } from 'vxe-pc-ui/es/modal';
import { VxeNumberInput } from 'vxe-pc-ui/es/number-input';
import { VxeOptgroup } from 'vxe-pc-ui/es/optgroup';
import { VxeOption } from 'vxe-pc-ui/es/option';
import { VxePager } from 'vxe-pc-ui/es/pager';
import { VxePrint } from 'vxe-pc-ui/es/print';
import { VxeRadio } from 'vxe-pc-ui/es/radio';
import { VxeRadioGroup } from 'vxe-pc-ui/es/radio-group';
import { VxeSelect } from 'vxe-pc-ui/es/select';
import { VxeSwitch } from 'vxe-pc-ui/es/switch';
import { VxeTooltip } from 'vxe-pc-ui/es/tooltip';
import { VxeUI } from 'vxe-pc-ui/es/ui';
import { VxeUpload } from 'vxe-pc-ui/es/upload';
import { VxeWatermark } from 'vxe-pc-ui/es/watermark';
import { VxeTable, VxeColumn, VxeColgroup, VxeGrid, VxeToolbar } from 'vxe-table';

import { formatTableDate } from './format';
import { registerOptionalVxeComponents } from './vxe-optional';
import 'vxe-pc-ui/styles/cssvar.scss';
import 'vxe-pc-ui/styles/base.scss';
import 'vxe-pc-ui/es/button/style.css';
import 'vxe-pc-ui/es/checkbox/style.css';
import 'vxe-pc-ui/es/checkbox-group/style.css';
import 'vxe-pc-ui/es/form/style.css';
import 'vxe-pc-ui/es/form-item/style.css';
import 'vxe-pc-ui/es/icon/style.css';
import 'vxe-pc-ui/es/input/style.css';
import 'vxe-pc-ui/es/loading/style.css';
import 'vxe-pc-ui/es/modal/style.css';
import 'vxe-pc-ui/es/number-input/style.css';
import 'vxe-pc-ui/es/pager/style.css';
import 'vxe-pc-ui/es/radio/style.css';
import 'vxe-pc-ui/es/radio-group/style.css';
import 'vxe-pc-ui/es/select/style.css';
import 'vxe-pc-ui/es/switch/style.css';
import 'vxe-pc-ui/es/tooltip/style.css';
import 'vxe-pc-ui/es/upload/style.css';
import 'vxe-table/lib/style.css';

import '../styles/table.css';

let initialized = false;
let stopSync: (() => void) | undefined;
export const tableLocale = shallowRef<TableLocale>('zh-CN');
export const tableMessages = {
  'zh-CN': { empty: '暂无数据', search: '搜索', show: '显示搜索面板', hide: '隐藏搜索面板' },
  'en-US': {
    empty: 'No data',
    search: 'Search',
    show: 'Show search panel',
    hide: 'Hide search panel',
  },
};
export function initVxeTable(): void {
  if (initialized) return;
  [
    VxeTable,
    VxeColumn,
    VxeColgroup,
    VxeGrid,
    VxeToolbar,
    VxeButton,
    VxeCheckbox,
    VxeCheckboxGroup,
    VxeForm,
    VxeFormItem,
    VxeIcon,
    VxeInput,
    VxeLoading,
    VxeModal,
    VxeNumberInput,
    VxePager,
    VxeRadio,
    VxeRadioGroup,
    VxeSelect,
    VxeOption,
    VxeOptgroup,
    VxeSwitch,
    VxeTooltip,
    VxeUpload,
    VxeDrawer,
    VxeWatermark,
    VxeContextMenu,
    VxePrint,
    VxeImagePreview,
    VxeColorPicker,
  ].forEach((component) => VxeUI.component(component));
  registerOptionalVxeComponents();
  const locales = { 'zh-CN': zhCN, 'en-US': enUS };
  for (const name of Object.keys(locales) as TableLocale[]) VxeUI.setI18n(name, locales[name]);
  VxeUI.setLanguage(tableLocale.value);
  // VXE supplies pager defaults even when the consumer has not requested a pager.
  VxeUI.setConfig({ grid: { pagerConfig: { enabled: false } } });
  for (const [name, format] of [
    ['formatDate', 'YYYY-MM-DD'],
    ['formatDateTime', 'YYYY-MM-DD HH:mm:ss'],
  ]) {
    VxeUI.formats.add(name!, {
      tableCellFormatMethod({ cellValue }) {
        return formatTableDate(cellValue, format!);
      },
    });
  }
  initialized = true;
}
/** One global synchronization owner; repeat setup replaces the previous subscriptions. */
export function setupVxeTable(options: TableSetupOptions = {}): () => void {
  initVxeTable();
  stopSync?.();
  const stops: (() => void)[] = [];
  const setLocale = (locale: TableLocale): void => {
    tableLocale.value = locale;
    VxeUI.setLanguage(locale);
  };
  if (isRef(options.locale)) stops.push(watch(options.locale, setLocale, { immediate: true }));
  else if (options.locale) setLocale(options.locale);
  if (isRef(options.theme))
    stops.push(watch(options.theme, (value) => VxeUI.setTheme(value), { immediate: true }));
  else if (options.theme) VxeUI.setTheme(options.theme);
  options.configVxeTable?.(VxeUI);
  const dispose = (): void => {
    stops.splice(0).forEach((stop) => stop());
  };
  stopSync = dispose;
  return dispose;
}
export { VxeUI };
