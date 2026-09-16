import type { VNode } from 'vue';

export interface LayoutHeaderSlotProps {
  isMobile: boolean;
  /** Opens global search only when its code-level feature is enabled. */
  openSearch: () => void;
  /** Opens preferences only when personalization is enabled. */
  openSettings: () => void;
}

export interface LayoutHeaderSlots {
  /** Replaces the entire right-hand area, including the user menu. */
  'header-right'?: (props: LayoutHeaderSlotProps) => VNode[];
  /** Inserts content before the default search and action buttons. */
  'header-right-before'?: (props: LayoutHeaderSlotProps) => VNode[];
  /** Inserts content after the default user menu. */
  'header-right-after'?: (props: LayoutHeaderSlotProps) => VNode[];
  /** Replaces only the user menu, retaining the default action buttons. */
  'header-user'?: (props: LayoutHeaderSlotProps) => VNode[];
}

export interface AdminLayoutSlots extends LayoutHeaderSlots {
  default?: () => VNode[];
}
