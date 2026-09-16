import type { FormLocale } from '../types';

export const zhCN: FormLocale = {
  selectRequired: (label) => `请选择${label}`,
  submit: '提交',
  reset: '重置',
  expand: '展开',
  collapse: '收起',
  retry: '重试',
  required: (label) => `请填写${label}`,
  operationFailed: '操作失败，请重试',
  remoteFailed: '加载失败，请重试',
};
export const enUS: FormLocale = {
  selectRequired: (label) => `Please select ${label}`,
  submit: 'Submit',
  reset: 'Reset',
  expand: 'Expand',
  collapse: 'Collapse',
  retry: 'Retry',
  required: (label) => `${label} is required`,
  operationFailed: 'Operation failed. Please retry.',
  remoteFailed: 'Loading failed. Please retry.',
};
