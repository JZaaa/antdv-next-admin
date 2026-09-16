const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const validTime = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;

export function summarizePerformance(report) {
  const fail = (detail) => {
    throw new Error(`性能报告不完整：${detail}。请重新运行 --performance。`);
  };
  const machine = report.measurement?.machine;
  if (
    !machine?.cpu ||
    !machine.node ||
    !machine.platform ||
    !machine.arch ||
    !Number.isFinite(machine.logicalCpus) ||
    machine.logicalCpus <= 0 ||
    !Number.isFinite(machine.memoryGiB) ||
    machine.memoryGiB <= 0 ||
    !Number.isFinite(Date.parse(report.measurement?.startedAt)) ||
    !Number.isFinite(Date.parse(report.generatedAt)) ||
    !report.browser?.product
  )
    fail('缺少原测试机器、时间或浏览器信息');
  if (report.mode !== 'production') fail('需要生产模式的测量');
  if (report.browserErrors?.length || report.consoleMessages?.some((item) => item.type === 'error'))
    fail('浏览器存在错误');
  if (
    !Array.isArray(report.results) ||
    report.results.length !== 12 ||
    report.results.some((result) => result.status !== 'pass')
  )
    fail('需要全部通过的 12 组测量');
  const summary = [];
  for (const fields of [100, 300]) {
    for (const kind of ['native', 'schema']) {
      const rounds = report.results
        .map((result) => result.observed)
        .filter((row) => row?.fields === fields && row.kind === kind);
      if (
        rounds.length !== 3 ||
        rounds
          .map((row) => row.round)
          .sort()
          .join(',') !== '1,2,3'
      )
        fail(`${kind}/${fields} 轮次缺失或重复`);
      for (const row of rounds) {
        if (
          row.samples !== 30 ||
          [row.tickSamples, row.frameSamples].some(
            (samples) =>
              !Array.isArray(samples) || samples.length !== 30 || !samples.every(validTime),
          )
        )
          fail(`${kind}/${fields} 原始样本缺失或无效`);
        if (
          ![
            row.mountMs,
            row.bulkMs,
            row.resetMs,
            row.dispatchToNextTickMs?.p50,
            row.dispatchToNextTickMs?.p95,
            row.dispatchToTwoAnimationFramesMs?.p50,
            row.dispatchToTwoAnimationFramesMs?.p95,
          ].every(validTime)
        )
          fail(`${kind}/${fields} 耗时无效`);
      }
      summary.push({
        fields,
        kind,
        rounds: rounds.length,
        mountMs: median(rounds.map((row) => row.mountMs)),
        bulkMs: median(rounds.map((row) => row.bulkMs)),
        resetMs: median(rounds.map((row) => row.resetMs)),
        dispatchToNextTickMs: {
          p50: median(rounds.map((row) => row.dispatchToNextTickMs.p50)),
          p95: median(rounds.map((row) => row.dispatchToNextTickMs.p95)),
        },
        dispatchToTwoAnimationFramesMs: {
          p50: median(rounds.map((row) => row.dispatchToTwoAnimationFramesMs.p50)),
          p95: median(rounds.map((row) => row.dispatchToTwoAnimationFramesMs.p95)),
        },
      });
    }
  }
  return { measurement: report.measurement, summary };
}
