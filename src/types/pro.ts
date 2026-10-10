// Pro Component Types

import type { ValueDisplayOptions, ValueType } from '../components/ValueDisplay/types';
import type { Component } from 'vue';

export type { ValueType } from '../components/ValueDisplay/types';

// ProForm Types
export type FormItemType =
  | 'input'
  | 'password'
  | 'textarea'
  | 'number'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'switch'
  | 'datePicker'
  | 'timePicker'
  | 'dateRange'
  | 'timeRange'
  | 'upload'
  | 'imageUpload'
  | 'avatarUpload'
  | 'slider'
  | 'rate'
  | 'colorPicker'
  | 'cascader'
  | 'treeSelect'
  | 'custom';

export interface ProFormOption {
  label: string;
  value: string | number | boolean;
  disabled?: boolean;
  children?: ProFormOption[];
}

export interface ProFormItem {
  name: string;
  label: string;
  type: FormItemType;
  required?: boolean;
  rules?: unknown[];
  initialValue?: unknown;
  dependencies?: string[];
  tooltip?: string;
  placeholder?: string;

  // Layout
  colSpan?: number;
  hidden?: boolean | ((values: Record<string, unknown>) => boolean);

  // Options (for select, radio, checkbox, etc.) — supports function form for dynamic options
  options?: ProFormOption[] | ((values: Record<string, unknown>) => ProFormOption[]);

  // Props to pass to the component
  props?: Record<string, unknown>;

  // Search behavior for select-like fields. Local search is enabled by default.
  searchable?: boolean;
  searchMode?: 'local' | 'remote';
  remoteSearch?: (keyword: string) => Promise<ProFormOption[]>;

  // Value prop name (for components like Switch that use 'checked')
  valuePropName?: string;

  // Custom render
  render?: Component;

  // Request for dynamic options
  request?: () => Promise<ProFormOption[]>;
}

export interface ProFormLayout {
  labelCol?: { span: number };
  wrapperCol?: { span: number };
  layout?: 'horizontal' | 'vertical' | 'inline';
}

export interface ProFormGrid {
  gutter?: number;
  cols?: number;
  responsive?: boolean;
  responsiveColumns?: number | Partial<Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', number>>;
}

export interface ProFormInstance<TValues extends object = Record<string, unknown>> {
  validate: () => Promise<TValues>;
  resetFields: () => void;
  clearValidate: () => void;
  setFieldsValue: (values: Partial<TValues>) => void;
  getFieldsValue: () => TValues;
}

// ProDescriptions Types
export interface ProDescriptionItem {
  label: string;
  dataIndex: string;
  valueType?: ValueType;
  valueEnum?: Record<string, { text: string; status?: string; color?: string }>;
  valueTypeProps?: ValueDisplayOptions;
  span?: number;
  render?: (value: unknown, record: Record<string, unknown>) => unknown;
  copyable?: boolean;
}

// ProStatus Types
export type ProStatusMode = 'dot' | 'tag' | 'badge';

export interface ProStatusMap {
  [key: string]: {
    text: string;
    color: string;
    icon?: unknown;
  };
}

// ProChart Types
export type ProChartType = 'line' | 'bar' | 'pie' | 'donut' | 'area' | 'radar';

export interface ProChartProps {
  type: ProChartType;
  data: Record<string, unknown>[];
  height?: number | string;
  title?: string;
  subTitle?: string;
  loading?: boolean;
  option?: Record<string, unknown>;
}

// ProUpload Types
export type ProUploadMode = 'button' | 'dragger' | 'image' | 'avatar';

// ProStatCard Types
export type ProStatCardTone = 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'cyan';

export interface ProStatCardProps {
  label: string;
  value: string | number;
  trend?: string;
  trendDirection?: 'up' | 'down';
  icon?: unknown;
  tone?: ProStatCardTone;
}

// ProStepForm Types
export interface ProStepFormStep {
  title: string;
  description?: string;
  icon?: unknown;
}

// ProSplitLayout Types
export interface ProSplitLayoutProps {
  sideWidth?: number | string;
  sidePosition?: 'left' | 'right';
  gap?: number | string;
}

// ProDetail Types
export interface ProDetailTab {
  key: string;
  label: string;
}
