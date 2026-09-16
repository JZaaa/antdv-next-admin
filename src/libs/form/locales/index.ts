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
export const jaJP: FormLocale = {
  selectRequired: (label) => `${label}を選択してください`,
  submit: '送信',
  reset: 'リセット',
  expand: '展開',
  collapse: '折りたたむ',
  retry: '再試行',
  required: (label) => `${label}を入力してください`,
  operationFailed: '操作に失敗しました',
  remoteFailed: '読み込みに失敗しました',
};
export const koKR: FormLocale = {
  selectRequired: (label) => `${label} 항목을 선택하세요`,
  submit: '제출',
  reset: '초기화',
  expand: '펼치기',
  collapse: '접기',
  retry: '재시도',
  required: (label) => `${label} 항목을 입력하세요`,
  operationFailed: '작업에 실패했습니다',
  remoteFailed: '불러오기에 실패했습니다',
};
