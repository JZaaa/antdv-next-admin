import { readFile, writeFile } from 'node:fs/promises';

export async function verifySchemaFormDocumentation(send, sessionId) {
  const results = [];
  async function evaluate(expression) {
    const response = await send(
      'Runtime.evaluate',
      { expression, returnByValue: true, awaitPromise: true },
      sessionId,
    );
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  }
  async function until(expression) {
    const start = Date.now();
    while (!(await evaluate(expression))) {
      if (Date.now() - start > 15000)
        throw new Error(
          `Documentation timed out: ${expression}; errors=${JSON.stringify(await evaluate("Array.from(document.querySelectorAll('.form-demo-preview .vben-field-error')).map(node => node.textContent)"))}`,
        );
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  function record(id, title, observed) {
    results.push({
      id: `schema-doc-${id}`,
      title,
      expected: '真实页面行为符合本项目文档',
      status: 'pass',
      observed,
    });
  }
  async function activate(id) {
    await evaluate(
      `(() => { const button = document.querySelector('[data-demo-run="${id}"]'); if (button.getAttribute('aria-expanded') === 'false') button.click(); })()`,
    );
    await until(`!!document.querySelector('#form-demo-${id} .vben-form')`);
  }
  async function fill(id, field, value, blur = false) {
    await evaluate(`(() => {
      const input = document.querySelector('#form-demo-${id} [data-vben-field="${field}"] input');
      if (!input) throw new Error('Missing input: ${id}/${field}');
      input.value = ${JSON.stringify(value)};
      input.dispatchEvent(new Event('input', { bubbles: true }));
      ${blur ? "input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));" : ''}
    })()`);
  }
  async function button(id, text) {
    await evaluate(
      `(() => { const button = Array.from(document.querySelectorAll('#form-demo-${id} .form-demo-preview button')).find(node => node.textContent.replace(/\\s/g, '') === ${JSON.stringify(text.replace(/\s/g, ''))}); if (!button) throw new Error('Missing button: ${text}'); button.click(); })()`,
    );
  }
  async function submit(id) {
    await until(
      `!!document.querySelector('#form-demo-${id} .vben-form button.ant-btn-primary:not(.ant-btn-loading):not([disabled])')`,
    );
    await evaluate(
      `document.querySelector('#form-demo-${id} .vben-form button.ant-btn-primary').click()`,
    );
  }
  async function choose(id, field, label) {
    await until(`!!document.querySelector('#form-demo-${id} [data-vben-field="${field}"] input')`);
    await evaluate(
      `document.querySelector('#form-demo-${id} [data-vben-field="${field}"] input').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`,
    );
    await until(
      `Array.from(document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')).some(node => node.textContent.trim() === ${JSON.stringify(label)})`,
    );
    await evaluate(
      `Array.from(document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')).find(node => node.textContent.trim() === ${JSON.stringify(label)}).click()`,
    );
  }

  await activate('basic');
  await fill('basic', 'name', '');
  await submit('basic');
  await until(`!!document.querySelector('#form-demo-basic [aria-invalid="true"]')`);
  await fill('basic', 'name', 'Doc Alice');
  await submit('basic');
  await until(
    `document.querySelector('#form-demo-basic output').textContent.includes('Doc Alice')`,
  );
  record('basic', '基础示例：真实输入、必填失败与提交', { name: 'Doc Alice' });

  await activate('controls');
  await until(
    `document.querySelectorAll('#form-demo-controls [data-vben-field]').length === 18 && !!document.querySelector('#form-demo-controls input[type=file]')`,
  );
  await fill('controls', 'input', 'all controls');
  await submit('controls');
  await until(
    `document.querySelector('#form-demo-controls output').textContent.includes('all controls')`,
  );
  record('controls', '18 控件示例挂载及提交', { controls: 18 });

  const selectionWidths = [];
  async function sampleSelectionWidths(stage) {
    selectionWidths.push(
      await evaluate(`new Promise(resolve => {
      const samples = [];
      function sample() {
        samples.push(Object.fromEntries(['select', 'tree', 'cascader'].map(name => {
          const field = document.querySelector('#form-demo-controls [data-vben-field="' + name + '"]');
          const root = field.querySelector('.ant-select');
          return [name, root.getBoundingClientRect().width];
        })));
        if (samples.length < 30) requestAnimationFrame(sample);
        else resolve({stage: ${JSON.stringify(stage)}, samples});
      }
      requestAnimationFrame(sample);
    })`),
    );
  }
  await sampleSelectionWidths('initial');
  await choose('controls', 'select', '研发');
  await sampleSelectionWidths('selected');
  await evaluate(
    `document.querySelector('#form-demo-controls [data-vben-field=select] .ant-select-clear').click()`,
  );
  await until(
    `!document.querySelector('#form-demo-controls [data-vben-field=select] .ant-select-content-value')?.textContent`,
  );
  await sampleSelectionWidths('cleared');
  await evaluate(
    `document.querySelector('#form-demo-controls [data-vben-field=input] input').focus()`,
  );
  await sampleSelectionWidths('blurred');
  const widthRanges = {};
  for (const name of ['select', 'tree', 'cascader']) {
    const values = selectionWidths.flatMap((stage) => stage.samples.map((sample) => sample[name]));
    widthRanges[name] = { min: Math.min(...values), max: Math.max(...values) };
    if (Math.max(...values) - Math.min(...values) > 1)
      throw new Error(
        'Selector width changed: ' + name + ' ' + Math.min(...values) + '–' + Math.max(...values),
      );
  }
  record('selection-widths', '选择及清空后保持聚焦、失焦时选择框宽度稳定', {
    widths: widthRanges,
  });
  await evaluate(`document.querySelector('#form-demo-controls').scrollIntoView()`);
  const controlsScreenshot = await send(
    'Page.captureScreenshot',
    { format: 'png', captureBeyondViewport: false },
    sessionId,
  );
  await writeFile(
    new URL('../../docs/spec/schema-form-controls-width.png', import.meta.url),
    Buffer.from(controlsScreenshot.data, 'base64'),
  );

  await activate('query');
  await button('query', '从提交值回填');
  await until(
    `document.querySelector('#form-demo-query [data-vben-field=keyword] input').value === 'codec'`,
  );
  await submit('query');
  await until(
    `document.querySelector('#form-demo-query output').textContent.includes('2026-09-01')`,
  );
  await button('query', '切换布局');
  await until(`!!document.querySelector('#form-demo-query .vben-field-vertical')`);
  record('query', 'codec 日期拆分、反向回填与布局切换', { start: '2026-09-01', end: '2026-09-15' });

  await activate('rules');
  await fill('rules', 'username', 'admin');
  await until(
    `document.querySelector('#form-demo-rules [data-vben-field=username]').textContent.includes('该用户名已被使用')`,
  );
  await fill('rules', 'username', 'alice');
  await fill('rules', 'password', 'secret');
  await fill('rules', 'confirm', 'different');
  await submit('rules');
  await until(
    `document.querySelector('#form-demo-rules [data-vben-field=confirm]').textContent.includes('两次密码不一致')`,
  );
  await fill('rules', 'confirm', 'secret');
  await fill('rules', 'email', 'bad', true);
  await until(
    `document.querySelector('#form-demo-rules [data-vben-field=email]').textContent.includes('请输入有效邮箱')`,
  );
  await fill('rules', 'email', '', true);
  await submit('rules');
  await until(`document.querySelector('#form-demo-rules output').textContent === '校验通过'`);
  record('rules', '异步规则、跨字段、blur 和可选空邮箱', {
    validation: 'passed after corrections',
  });

  await activate('dependencies');
  await choose('dependencies', 'city', '杭州');
  await choose('dependencies', 'region', '华南');
  await choose('dependencies', 'city', '深圳');
  await choose('dependencies', 'mode', 'show 隐藏');
  await submit('dependencies');
  await until(
    `(() => { try { const value = JSON.parse(document.querySelector('#form-demo-dependencies output').textContent); return value.raw.detail === '保留内容' && value.submitted.detail === '保留内容' && value.submitted.city === '深圳'; } catch { return false; } })()`,
  );
  await choose('dependencies', 'mode', 'if 卸载');
  await until(`!document.querySelector('#form-demo-dependencies [data-vben-field=detail]')`);
  await choose('dependencies', 'mode', '显示');
  await button('dependencies', '切换 hide');
  await until(`!document.querySelector('#form-demo-dependencies [data-vben-field=detail]')`);
  await submit('dependencies');
  await until(
    `(() => { try { return JSON.parse(document.querySelector('#form-demo-dependencies output').textContent).submitted.detail === '保留内容'; } catch { return false; } })()`,
  );
  await button('dependencies', '切换 hide');
  await until(`!!document.querySelector('#form-demo-dependencies [data-vben-field=detail] input')`);
  await button('dependencies', '重新加载城市');
  await until(
    `document.querySelector('#form-demo-dependencies output').textContent === '城市选项已重新加载'`,
  );
  record('dependencies', '级联远程选项、隐藏值提交、hide/if 卸载与 异步联动重新加载', {
    city: '深圳',
    hiddenIncluded: true,
  });

  await activate('slots');
  await fill('slots', 'color', '#ff0000');
  await fill('slots', 'amount', '200');
  await button('slots', '保存设置');
  await until(
    `(() => { try { const value = JSON.parse(document.querySelector('#form-demo-slots output').textContent); return value.color === '#ff0000' && value.amount === 200; } catch { return false; } })()`,
  );
  await button('slots', '恢复默认');
  await until(`document.querySelector('#form-demo-slots input[type=color]').value === '#1677ff'`);
  record('slots', '自定义 modelPropName、字段及 submit-before 插槽', {
    color: '#ff0000',
    amount: 200,
    reset: true,
  });

  await activate('api');
  await button('api', '单字段校验');
  await until(`document.querySelector('#form-demo-api output').textContent.includes('errors')`);
  await button('api', '回填');
  await until(
    `document.querySelector('#form-demo-api [data-vben-field=name] input').value === 'API Alice'`,
  );
  await button('api', '服务端错误');
  await until(
    `document.querySelector('#form-demo-api [data-vben-field=name]').textContent.includes('名称已存在')`,
  );
  await button('api', '清除校验');
  await until(`!document.querySelector('#form-demo-api [aria-invalid=true]')`);
  await button('api', '设置单字段');
  await until(
    `document.querySelector('#form-demo-api [data-vben-field=name] input').value === '单字段值'`,
  );
  await button('api', '更新标签');
  await until(
    `document.querySelector('#form-demo-api label').textContent.includes('更新后的名称')`,
  );
  await button('api', '增删字段');
  await until(`!!document.querySelector('#form-demo-api [data-vben-field=extra]')`);
  await button('api', '增删字段');
  await until(`!document.querySelector('#form-demo-api [data-vben-field=extra]')`);
  await button('api', '切换禁用');
  await until(`document.querySelector('#form-demo-api [data-vben-field=name] input').disabled`);
  await button('api', '切换禁用');
  await button('api', '建立重置基线');
  await until(
    `document.querySelector('#form-demo-api [data-vben-field=name] input').value === '新基线'`,
  );
  await fill('api', 'name', 'changed');
  await button('api', '重置');
  await until(
    `document.querySelector('#form-demo-api [data-vben-field=name] input').value === '新基线'`,
  );
  await button('api', '聚焦名称');
  await until(
    `document.activeElement === document.querySelector('#form-demo-api [data-vben-field=name] input')`,
  );
  await button('api', 'API 提交');
  await until(
    `(() => { try { return JSON.parse(document.querySelector('#form-demo-api output').textContent).name === '新基线'; } catch { return false; } })()`,
  );
  await button('api', '读取快照');
  await until(`document.querySelector('#form-demo-api output').textContent.includes('"status"')`);
  record('api', '公开 API 实际操作与重置基线', {
    dynamicFields: true,
    serverErrors: true,
    focus: true,
  });

  const sources = {
    groups: ['GroupArrayDemo.vue'],
    basic: ['BasicDemo.vue'],
    controls: ['ControlsDemo.vue'],
    query: ['QueryDemo.vue'],
    rules: ['RulesDemo.vue'],
    dependencies: ['DependenciesDemo.vue'],
    slots: ['SlotsDemo.vue', 'ColorControl.vue'],
    api: ['ApiDemo.vue'],
    integration: ['IntegrationDemo.vue', 'adapters/form.ts'],
  };
  for (const [id, files] of Object.entries(sources)) {
    await evaluate(`document.querySelector('#form-demo-${id} details').open = true`);
    await until(
      `document.querySelectorAll('#form-demo-${id} .form-demo-file pre code').length === ${files.length}`,
    );
    const displayed = await evaluate(
      `Array.from(document.querySelectorAll('#form-demo-${id} .form-demo-file pre code')).map(node => node.textContent)`,
    );
    for (const [index, file] of files.entries()) {
      const url =
        file === 'adapters/form.ts'
          ? new URL('../../src/adapters/form.ts', import.meta.url)
          : new URL(`../../src/views/examples/schema-form/demos/${file}`, import.meta.url);
      const source = await readFile(url, 'utf8');
      if (displayed[index].replace(/\r\n/g, '\n') !== source.replace(/\r\n/g, '\n'))
        throw new Error(`Displayed code differs from running source: ${file}`);
    }
    await evaluate(`document.querySelector('#form-demo-${id} details').open = false`);
  }
  record('source', '9 组示例与适配器源码逐字核对', { files: 11, source: 'Vite ?raw imports' });

  await evaluate(
    `(() => { const input = document.querySelector('.form-doc-filters input'); input.value = 'submitOnChange'; input.dispatchEvent(new Event('input', { bubbles: true })); })()`,
  );
  await until(
    `document.querySelectorAll('#form-vben-audit tbody tr').length === 1 && document.querySelector('#form-vben-audit tbody .ant-tag').textContent === '已实现'`,
  );
  await evaluate(
    `(() => { const input = document.querySelector('.form-doc-filters input'); input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); })()`,
  );
  await until(`document.querySelectorAll('#form-vben-audit tbody tr').length > 100`);
  const auditText = await evaluate("document.querySelector('#form-vben-audit table').innerText");
  if (/历史|未提供|语义不同/.test(auditText))
    throw new Error('Audit still displays historical state');
  await evaluate(
    "document.querySelector('.form-doc-filters .ant-select').dispatchEvent(new MouseEvent('mousedown', {bubbles:true}))",
  );
  await until(
    "Array.from(document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')).some(node => node.textContent.trim() === '排除')",
  );
  await evaluate(
    "Array.from(document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')).find(node => node.textContent.trim() === '排除').click()",
  );
  await until(
    "document.querySelectorAll('#form-vben-audit tbody tr').length === 5 && Array.from(document.querySelectorAll('#form-vben-audit tbody .ant-tag')).every(node => node.textContent === '排除')",
  );
  await evaluate(
    "document.querySelector('.form-doc-filters .ant-select').dispatchEvent(new MouseEvent('mousedown', {bubbles:true}))",
  );
  await until(
    "Array.from(document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')).some(node => node.textContent.trim() === '全部')",
  );
  await evaluate(
    "Array.from(document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')).find(node => node.textContent.trim() === '全部').click()",
  );
  await until("document.querySelectorAll('#form-vben-audit tbody tr').length === 115");
  await evaluate(`document.querySelector('[data-demo-run=api]').click()`);
  await evaluate(
    `Array.from(document.querySelectorAll('#form-api tbody tr')).find(row => row.querySelector('code')?.textContent === 'setFieldValue').querySelector('button').click()`,
  );
  await until(
    `document.querySelector('[data-demo-run=api]').getAttribute('aria-expanded') === 'true'`,
  );
  record('reference', 'API 到运行示例导航、当前能力搜索与状态筛选', {
    search: 'submitOnChange',
    status: '已实现',
  });

  await activate('groups');
  await until("!!document.querySelector('#form-demo-groups .vben-form')");
  await evaluate(
    "document.querySelector('#form-demo-groups form').dispatchEvent(new Event('submit', {bubbles:true,cancelable:true}))",
  );
  await until("!!document.querySelector('#form-demo-groups .vben-field-error')");
  await evaluate(
    `(() => { const input=document.querySelector('#form-demo-groups [data-vben-field="name"] input'); input.value='Migrated Alice'; input.dispatchEvent(new Event('input',{bubbles:true})); })()`,
  );
  await evaluate(
    "document.querySelector('#form-demo-groups form').dispatchEvent(new Event('submit', {bubbles:true,cancelable:true}))",
  );
  await until(
    "document.querySelector('#form-demo-groups .form-demo-preview pre').textContent.includes('Migrated Alice')",
  );
  const modern = await evaluate(
    "JSON.parse(document.querySelector('#form-demo-groups .form-demo-preview pre').textContent)",
  );
  if (!modern.values.retained || modern.rawValues.name !== 'Migrated Alice')
    throw new Error('Modern migration payload mismatch');
  await evaluate(
    `Array.from(document.querySelectorAll('#form-demo-groups button')).find(button => button.textContent.includes('添加一行')).click()`,
  );
  await until("document.querySelectorAll('#form-demo-groups .vben-array-row').length === 1");
  record('modern', '现代迁移示例：字段名插槽、提交校验、隐藏保值及数组增行', modern);
  const switchSize = await evaluate(
    `(() => { const control=document.querySelector('#form-demo-groups [data-vben-field="advanced"] [role="switch"]'); return {width: control.getBoundingClientRect().width, grow: getComputedStyle(control).flexGrow}; })()`,
  );
  if (switchSize.width > 80 || switchSize.grow !== '0')
    throw new Error('Switch stretched: ' + JSON.stringify(switchSize));
  const baselineHeight = await evaluate(
    "document.querySelector('#form-demo-groups .vben-array-row').getBoundingClientRect().height",
  );
  for (const email of ['bad', 'still-bad', 'alice@example.com', 'invalid-again', '']) {
    await evaluate(
      `(() => { const input=document.querySelector('#form-demo-groups [data-vben-field="contacts[0].email"] input'); input.value=${JSON.stringify(email)}; input.dispatchEvent(new Event('input',{bubbles:true})); })()`,
    );
    await until(
      `Boolean(document.querySelector('#form-demo-groups [data-vben-field="contacts[0].email"] .vben-field-error')) === ${email !== '' && email !== 'alice@example.com'}`,
    );
    const height = await evaluate(
      "document.querySelector('#form-demo-groups .vben-array-row').getBoundingClientRect().height",
    );
    if (Math.abs(height - baselineHeight) > 1)
      throw new Error(
        'Email validation shifted row: ' + JSON.stringify({ email, baselineHeight, height }),
      );
  }
  record('modern-styles', '开关保持自然宽度，邮箱校验切换不改变数组行高', {
    switchSize,
    rowHeight: baselineHeight,
  });
  await evaluate(
    "document.querySelector('#form-demo-groups').scrollIntoView(); new Promise(resolve => setTimeout(resolve, 150))",
  );
  const modernScreenshot = await send(
    'Page.captureScreenshot',
    { format: 'png', captureBeyondViewport: false },
    sessionId,
  );
  await writeFile(
    new URL('../../docs/spec/schema-form-modern-styles.png', import.meta.url),
    Buffer.from(modernScreenshot.data, 'base64'),
  );

  // 展示首页和实际代码；关闭其他预览，验证按需挂载后的窄屏布局。
  await evaluate(
    `(() => { for (const button of document.querySelectorAll('[data-demo-run]')) { if (button.dataset.demoRun !== 'basic' && button.getAttribute('aria-expanded') === 'true') button.click(); } document.querySelector('#form-demo-basic details').open = true; document.querySelector('.form-doc-intro').scrollIntoView(); })()`,
  );
  await send(
    'Emulation.setDeviceMetricsOverride',
    { width: 390, height: 844, deviceScaleFactor: 1, mobile: false },
    sessionId,
  );
  await evaluate('new Promise(resolve => setTimeout(resolve, 400))');
  const narrow = await evaluate(
    `(() => { const doc = document.querySelector('.form-documentation'); return { width: doc.clientWidth, scrollWidth: doc.scrollWidth, basicWidth: document.querySelector('#form-demo-basic .vben-form').clientWidth }; })()`,
  );
  if (narrow.scrollWidth > narrow.width + 1)
    throw new Error(`Documentation narrow overflow: ${JSON.stringify(narrow)}`);
  const mobile = await send(
    'Page.captureScreenshot',
    { format: 'png', captureBeyondViewport: false },
    sessionId,
  );
  await send(
    'Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false },
    sessionId,
  );
  await evaluate(
    `document.querySelector('.form-doc-intro').scrollIntoView(); new Promise(resolve => setTimeout(resolve, 400))`,
  );
  record('responsive', '390px 文档布局与代码/表格局部滚动', narrow);
  return { results, mobileScreenshot: mobile.data };
}
