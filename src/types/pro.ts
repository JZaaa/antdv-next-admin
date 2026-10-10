// Pro Component Types

import type { ValueDisplayOptions, ValueType } from '../components/ValueDisplay/types';

export type { ValueType } from '../components/ValueDisplay/types';

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
