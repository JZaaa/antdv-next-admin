import { describe, expect, it } from 'vitest';

import { summarizePerformance } from '../../scripts/form/performance-report.mjs';

function report() {
  return {
    generatedAt: '2026-09-16T00:00:00Z',
    mode: 'production',
    browser: { product: 'HeadlessChrome/100.0.4896.0' },
    measurement: {
      startedAt: '2026-09-15T23:59:00Z',
      machine: {
        cpu: 'Original test CPU',
        logicalCpus: 8,
        memoryGiB: 16,
        platform: 'linux',
        arch: 'x64',
        node: 'v22.0.0',
      },
    },
    results: [100, 300].flatMap((fields) =>
      ['native', 'schema'].flatMap((kind) =>
        [1, 2, 3].map((round) => ({
          status: 'pass',
          observed: {
            fields,
            kind,
            round,
            samples: 30,
            mountMs: round,
            bulkMs: round,
            resetMs: round,
            tickSamples: Array.from({ length: 30 }, () => round),
            frameSamples: Array.from({ length: 30 }, () => round),
            dispatchToNextTickMs: { p50: round, p95: round },
            dispatchToTwoAnimationFramesMs: { p50: round, p95: round },
          },
        })),
      ),
    ),
  };
}

describe('performance report provenance and completeness', () => {
  it('retains the original measurement machine and aggregates all four groups', () => {
    const input = report();
    const output = summarizePerformance(input);
    expect(output.measurement).toEqual(input.measurement);
    expect(output.summary).toHaveLength(4);
    expect(output.summary.every((row) => row.mountMs === 2 && row.rounds === 3)).toBe(true);
  });

  it('rejects missing or duplicate rounds, even when the total result count is correct', () => {
    const input = report();
    input.results[1]!.observed.round = 1;
    expect(() => summarizePerformance(input)).toThrow('轮次缺失或重复');
    input.results.pop();
    expect(() => summarizePerformance(input)).toThrow('12 组');
  });

  it('rejects failed scenarios and malformed raw samples', () => {
    const input = report();
    input.results[0]!.status = 'error';
    expect(() => summarizePerformance(input)).toThrow('12 组');
    input.results[0]!.status = 'pass';
    input.results[0]!.observed.tickSamples[0] = Number.NaN;
    expect(() => summarizePerformance(input)).toThrow('原始样本');
    input.results[0]!.observed.tickSamples.pop();
    expect(() => summarizePerformance(input)).toThrow('原始样本');
  });

  it('rejects older reports without measurement provenance and development runs', () => {
    const input = report();
    expect(() => summarizePerformance({ ...input, measurement: undefined })).toThrow('原测试机器');
    expect(() => summarizePerformance({ ...input, mode: 'development' })).toThrow('生产模式');
    expect(() => summarizePerformance({ ...input, browserErrors: [{}] })).toThrow('浏览器存在错误');
  });
});
