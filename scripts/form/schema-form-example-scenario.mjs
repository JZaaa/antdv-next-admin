import { verifySchemaFormDocumentation } from './schema-form-documentation-scenario.mjs';

export async function verifySchemaFormExample(send, sessionId, username, options = {}) {
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
      if (Date.now() - start > 20000) throw new Error(`Example timed out: ${expression}`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  await until('!!document.querySelector("input[autocomplete=username]")');
  await evaluate(`(() => {
    const user = document.querySelector('input[autocomplete=username]');
    const password = document.querySelector('input[autocomplete=current-password]');
    user.value = ${JSON.stringify(username)}; password.value = '123456';
    user.dispatchEvent(new Event('input', { bubbles: true })); password.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  const slider = await evaluate(
    `(() => { const handle = document.querySelector('.slider-handle').getBoundingClientRect(); const track = document.querySelector('.slider-bg').getBoundingClientRect(); return { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2, end: track.right }; })()`,
  );
  await send(
    'Input.dispatchMouseEvent',
    { type: 'mousePressed', x: slider.x, y: slider.y, button: 'left', clickCount: 1 },
    sessionId,
  );
  await send(
    'Input.dispatchMouseEvent',
    { type: 'mouseMoved', x: slider.end, y: slider.y, button: 'left', buttons: 1 },
    sessionId,
  );
  await send(
    'Input.dispatchMouseEvent',
    { type: 'mouseReleased', x: slider.end, y: slider.y, button: 'left', clickCount: 1 },
    sessionId,
  );
  await until('!document.querySelector(".login-form button[type=submit]").disabled');
  await evaluate('document.querySelector(".login-form button[type=submit]").click()');
  await until('!!document.querySelector(".form-documentation")');
  await evaluate(`document.querySelector('[data-demo-run="integration"]').click()`);
  await until('!!document.querySelector(".schema-form-example")');
  const results = [
    {
      id: 'schema-example-login',
      title: `${username} 登录并进入示例`,
      expected: '正常登录、路由和菜单权限',
      status: 'pass',
      observed: { username },
    },
  ];
  await evaluate(
    `Array.from(document.querySelectorAll('.example-tools button')).find(button => button.textContent.includes('回填数据')).click()`,
  );
  await until(
    `document.querySelector('.schema-form-example [data-vben-field=name] input')?.value === 'alice'`,
  );
  await evaluate(
    `document.querySelector('.schema-form-example .vben-form button.ant-btn-primary').click()`,
  );
  await until(`document.querySelector('.schema-form-example pre')?.textContent.includes('alice')`);
  results.push({
    id: 'schema-example-submit',
    title: '回填、联动、异步规则和提交',
    expected: '示例记录保存成功',
    status: 'pass',
    observed: { saved: 'alice' },
  });
  await evaluate(
    `Array.from(document.querySelectorAll('.example-tools button')).find(button => button.textContent.includes('添加字段')).click()`,
  );
  await until(`!!document.querySelector('[data-vben-field=extra] input')`);
  await evaluate(
    `Array.from(document.querySelectorAll('.example-tools button')).find(button => button.textContent.includes('移除字段')).click()`,
  );
  await until(`!document.querySelector('[data-vben-field=extra]')`);
  results.push({
    id: 'schema-example-fields',
    title: '动态字段操作',
    expected: '增删字段正确反映到页面',
    status: 'pass',
    observed: { addedAndRemoved: true },
  });
  await evaluate(
    `Array.from(document.querySelectorAll('.example-tools button')).find(button => button.textContent.includes('编辑记录')).click()`,
  );
  await until(`!!document.querySelector('.ant-modal [data-vben-field=name] input')`);
  await evaluate(
    `(() => { const input = document.querySelector('.ant-modal [data-vben-field=name] input'); input.value = 'bob'; input.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('.ant-modal .vben-form button.ant-btn-primary').click(); })()`,
  );
  await until(
    `!document.querySelector('.ant-modal [data-vben-field=name] input') && document.querySelector('.schema-form-example pre')?.textContent.includes('bob')`,
  );
  await evaluate(
    `Array.from(document.querySelectorAll('.example-tools button')).find(button => button.textContent.includes('编辑记录')).click()`,
  );
  await until(
    `document.querySelector('.ant-modal [data-vben-field=name] input')?.value === 'alice'`,
  );
  await evaluate(`document.querySelector('.ant-modal-close').click()`);
  await until(`!document.querySelector('.ant-modal [data-vben-field=name] input')`);
  results.push({
    id: 'schema-example-modal',
    title: 'Modal 保存、销毁和重开',
    expected: '新会话恢复新初值，不沿用旧记录',
    status: 'pass',
    observed: { saved: 'bob', reopened: 'alice' },
  });
  await evaluate(
    `(() => { const field = document.querySelector('[data-vben-field=keyword] input'); field.value = 'example'; field.dispatchEvent(new Event('input', { bubbles: true })); field.closest('.vben-form').querySelector('button.ant-btn-primary').click(); })()`,
  );
  await until(
    `Array.from(document.querySelectorAll('.example-result')).some(node => node.textContent.includes('"keyword":"example"'))`,
  );
  results.push({
    id: 'schema-example-search',
    title: '查询表单与 codec',
    expected: '提交条件显示 keyword',
    status: 'pass',
    observed: { keyword: 'example' },
  });
  for (const [language, submitLabel, nameLabel] of [
    ['English', 'Submit', 'Username'],
    ['简体中文', '提交', '用户名'],
  ]) {
    await evaluate(
      "document.querySelector('.admin-header .anticon-global').closest('button').click()",
    );
    await until(
      `Array.from(document.querySelectorAll('.ant-dropdown-menu-item')).some(node => node.textContent.trim() === ${JSON.stringify(language)})`,
    );
    await evaluate(
      `Array.from(document.querySelectorAll('.ant-dropdown-menu-item')).find(node => node.textContent.trim() === ${JSON.stringify(language)}).click()`,
    );
    await until(
      `document.querySelector('.schema-form-example .vben-form button.ant-btn-primary').textContent.replace(/\\s/g, '') === ${JSON.stringify(submitLabel)} && document.querySelector('.schema-form-example [data-vben-field=name] label').textContent.includes(${JSON.stringify(nameLabel)})`,
    );
  }
  results.push({
    id: 'schema-example-locale',
    title: '同一入口中英文切换',
    expected: '切换宿主语言后表单标签与操作按钮同步更新',
    status: 'pass',
    observed: { languages: ['en-US', 'zh-CN'] },
  });
  await send(
    'Emulation.setDeviceMetricsOverride',
    { width: 390, height: 844, deviceScaleFactor: 1, mobile: false },
    sessionId,
  );
  await evaluate('new Promise(resolve => setTimeout(resolve, 350))');
  const narrow = await evaluate(
    `(() => { const form = document.querySelector('.schema-form-example .vben-form'); return { width: form.clientWidth, scrollWidth: form.scrollWidth, columns: getComputedStyle(form.querySelector('.vben-form-grid')).gridTemplateColumns }; })()`,
  );
  if (narrow.scrollWidth > narrow.width + 1)
    throw new Error(`Narrow form overflows: ${JSON.stringify(narrow)}`);
  const mobileScreenshot = await send(
    'Page.captureScreenshot',
    { format: 'png', captureBeyondViewport: false },
    sessionId,
  );
  await send(
    'Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false },
    sessionId,
  );
  await evaluate('new Promise(resolve => setTimeout(resolve, 350))');
  results.push({
    id: 'schema-example-narrow',
    title: '390px 窄视口',
    expected: '表单单列且无横向溢出',
    status: 'pass',
    observed: narrow,
  });
  let documentationArtifacts;
  if (options.documentation) {
    documentationArtifacts = await verifySchemaFormDocumentation(send, sessionId);
    results.push(...documentationArtifacts.results);
  }
  const report = {
    generatedAt: new Date().toISOString(),
    userAgent: await evaluate('navigator.userAgent'),
    mode: options.development ? 'development' : 'demo-production',
    results,
  };
  await evaluate(
    `(() => { const report = document.createElement('pre'); report.id = 'lab-report'; report.hidden = true; report.textContent = ${JSON.stringify(JSON.stringify(report))}; document.body.append(report); document.documentElement.dataset.labStatus = 'complete'; window.scrollTo(0, 0); })()`,
  );
  return { mobileScreenshot: documentationArtifacts?.mobileScreenshot ?? mobileScreenshot.data };
}
