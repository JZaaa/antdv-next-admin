export interface ModernAudit {
  status: '已实现' | '有意差异' | '已测量' | '部分排除' | '排除';
  note: string;
  source: string;
  evidence: string;
}
