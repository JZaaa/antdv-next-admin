export async function verifyExample(send, session, username) {
  async function evaluate(expression) {
    const response = await send(
      'Runtime.evaluate',
      { expression, returnByValue: true, awaitPromise: true },
      session,
    );
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  }
  async function until(expression) {
    const start = Date.now();
    while (!(await evaluate(expression))) {
      if (Date.now() - start > 15000) throw new Error(`Example condition failed: ${expression}`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  const results = [];
  await until('!!document.querySelector("input[autocomplete=username]")');
  await evaluate(`(() => {
    const user=document.querySelector('input[autocomplete=username]'),password=document.querySelector('input[autocomplete=current-password]');
    user.value=${JSON.stringify(username)};password.value='123456';user.dispatchEvent(new Event('input',{bubbles:true}));password.dispatchEvent(new Event('input',{bubbles:true}));
  })()`);
  const slider = await evaluate(
    `(() => {const handle=document.querySelector('.slider-handle').getBoundingClientRect(),track=document.querySelector('.slider-bg').getBoundingClientRect();return {x:handle.x+handle.width/2,y:handle.y+handle.height/2,end:track.right};})()`,
  );
  for (const [type, x] of [
    ['mousePressed', slider.x],
    ['mouseMoved', slider.end],
    ['mouseReleased', slider.end],
  ])
    await send(
      'Input.dispatchMouseEvent',
      {
        type,
        x,
        y: slider.y,
        button: 'left',
        buttons: type === 'mouseReleased' ? 0 : 1,
        clickCount: 1,
      },
      session,
    );
  await until('!document.querySelector(".login-form button[type=submit]").disabled');
  await evaluate('document.querySelector(".login-form button[type=submit]").click()');
  await until('!!document.querySelector(".vxe-documentation .vxe-body--row")');
  results.push({ id: 'example-login', status: 'pass', observed: username });
  const click = async (id, text) =>
    evaluate(
      `Array.from(document.querySelectorAll('[data-table-demo="${id}"] button')).find(button=>button.textContent.replace(/\\s/g,'')==='${text}').click()`,
    );
  await click('basic', '清空');
  await until(`!document.querySelector('[data-table-demo="basic"] .vxe-body--row')`);
  await click('basic', '恢复');
  await until(`!!document.querySelector('[data-table-demo="basic"] .vxe-body--row')`);
  results.push({ id: 'example-basic-data', status: 'pass' });
  for (const id of ['search', 'edit', 'tree', 'virtual', 'viewed']) {
    await evaluate(`document.querySelector('[data-run="${id}"]').click()`);
    await until(`!!document.querySelector('[data-table-demo="${id}"] .vxe-body--row')`);
  }
  await evaluate(
    `(() => {const input=document.querySelector('[data-table-demo="search"] input');input.value='Member 12';input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-table-demo="search"] .vben-form .ant-btn-primary').click();})()`,
  );
  await until(
    `document.querySelector('[data-table-demo="search"] [role=status]').textContent.includes('Member 12')`,
  );
  results.push({ id: 'example-codec-search', status: 'pass' });
  await click('edit', '编辑');
  await until(`!!document.querySelector('[data-table-demo="edit"] .vxe-body--row input')`);
  await evaluate(
    `document.querySelector('[data-table-demo="edit"] .ant-select-content').dispatchEvent(new MouseEvent('mousedown',{bubbles:true}))`,
  );
  await until(`!!document.querySelector('.ant-select-dropdown .ant-select-item-option')`);
  await evaluate(
    `Array.from(document.querySelectorAll('.ant-select-dropdown .ant-select-item-option')).find(option=>option.textContent.includes('管理员')).click()`,
  );
  await until(`!!document.querySelector('[data-table-demo="edit"] .vxe-body--row input')`);
  await evaluate(`document.querySelector('[data-table-demo="edit"] .ant-picker input').click()`);
  await until(`!!document.querySelector('.ant-picker-dropdown')`);
  await send(
    'Input.dispatchKeyEvent',
    { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 },
    session,
  );
  await send(
    'Input.dispatchKeyEvent',
    { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 },
    session,
  );
  await evaluate(
    `(() => {const input=document.querySelector('[data-table-demo="edit"] .vxe-body--row input');input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));input.value='中文输入';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));})()`,
  );
  results.push({ id: 'example-select-date-popup-ime', status: 'pass' });
  await evaluate(`document.querySelector('[data-table-demo="edit"] .vxe-body--row input').focus()`);
  for (const [key, code] of [
    ['Enter', 13],
    ['Tab', 9],
  ]) {
    for (const type of ['keyDown', 'keyUp']) {
      await send(
        'Input.dispatchKeyEvent',
        { type, key, code: key, windowsVirtualKeyCode: code },
        session,
      );
    }
  }
  const keyboard = await evaluate(`(() => {
    const row = document.querySelector('[data-table-demo="edit"] .vxe-body--row');
    const input = row.querySelector('input');
    return { value: input?.value, moved: document.activeElement !== input, inRow: row.contains(document.activeElement) };
  })()`);
  if (keyboard.value !== '中文输入' || !keyboard.moved || !keyboard.inRow)
    throw new Error(`Editor keyboard/IME: ${JSON.stringify(keyboard)}`);
  results.push({ id: 'example-enter-tab-blur-preserve-edit', status: 'pass', observed: keyboard });
  await evaluate(
    `(() => {const input=document.querySelector('[data-table-demo="edit"] .vxe-body--row input');input.value='Edited';input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  await click('edit', '取消');
  await until(
    `document.querySelector('[data-table-demo="edit"] [role=status]').textContent.includes('已恢复')`,
  );
  results.push({ id: 'example-edit-cancel-restores', status: 'pass' });
  await click('edit', '编辑');
  await evaluate(
    `document.querySelector('[data-table-demo="edit"] .demo-actions .ant-switch').click()`,
  );
  await click('edit', '保存');
  await until(
    `document.querySelector('[data-table-demo="edit"] [role=status]').textContent.includes('模拟服务端拒绝')`,
  );
  await evaluate(
    `document.querySelector('[data-table-demo="edit"] .demo-actions .ant-switch').click()`,
  );
  await click('edit', '保存');
  await until(
    `document.querySelector('[data-table-demo="edit"] [role=status]').textContent.includes('保存成功')`,
  );
  results.push({ id: 'example-save-failure-retry', status: 'pass' });
  await click('edit', '编辑');
  await click('edit', '保存');
  await click('edit', '取消');
  await new Promise((resolve) => setTimeout(resolve, 400));
  await until(
    `document.querySelector('[data-table-demo="edit"] [role=status]').textContent.includes('已恢复')`,
  );
  results.push({ id: 'example-late-save-cancel', status: 'pass' });
  await click('tree', '展开全部');
  await until(`document.querySelector('[data-table-demo="tree"]').textContent.includes('前端')`);
  results.push({ id: 'example-tree-expand', status: 'pass' });
  await click('viewed', '标记已读');
  await until(`!!document.querySelector('[data-table-demo="viewed"] .vxe-row--viewed')`);
  await click('viewed', '清空已读');
  await until(`!document.querySelector('[data-table-demo="viewed"] .vxe-row--viewed')`);
  results.push({ id: 'example-viewed-operation', status: 'pass' });
  const virtualRows = await evaluate(
    `document.querySelectorAll('[data-table-demo="virtual"] .vxe-body--row').length`,
  );
  if (virtualRows > 100) throw new Error(`Virtual rows ${virtualRows}`);
  results.push({ id: 'example-virtual', status: 'pass', observed: virtualRows });
  const sources = await evaluate(
    `Array.from(document.querySelectorAll('.vxe-documentation pre')).every(node=>node.textContent.includes('useVxeGrid'))`,
  );
  if (!sources) throw new Error('Running source display missing');
  results.push({ id: 'example-source-display', status: 'pass' });
  await evaluate(`document.querySelector('.theme-icon-wrapper').closest('button').click()`);
  await until(`document.documentElement.getAttribute('data-vxe-ui-theme')==='dark'`);
  await until(`!document.documentElement.classList.contains('theme-transition')`);
  const dark = await evaluate(
    `getComputedStyle(document.querySelector('.vxe-documentation .schema-grid')).backgroundColor`,
  );
  if (dark === 'rgb(255, 255, 255)') throw new Error('Dark table remains white');
  results.push({ id: 'example-dark-theme', status: 'pass', observed: dark });
  await evaluate(`document.querySelector('.theme-icon-wrapper').closest('button').click()`);
  await until(`document.documentElement.getAttribute('data-vxe-ui-theme')==='light'`);
  await send(
    'Emulation.setDeviceMetricsOverride',
    { width: 390, height: 844, deviceScaleFactor: 1, mobile: false },
    session,
  );
  await evaluate('window.scrollTo(0,0)');
  await new Promise((resolve) => setTimeout(resolve, 300));
  const screenshot = (await send('Page.captureScreenshot', { format: 'png' }, session)).data;
  const narrow = await evaluate(
    `({width:innerWidth,tableWidth:document.querySelector('.vxe-documentation .schema-grid').getBoundingClientRect().width})`,
  );
  if (narrow.tableWidth > 390) throw new Error(`Narrow wrapper overflow ${JSON.stringify(narrow)}`);
  results.push({ id: 'example-390px', status: 'pass', observed: narrow });
  await send('Emulation.clearDeviceMetricsOverride', {}, session);
  await evaluate('window.scrollTo(0,0)');
  return { results, screenshot };
}
