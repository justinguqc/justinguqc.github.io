/* global acquireVsCodeApi */
const vscode = acquireVsCodeApi();
const app = document.getElementById('app');
let model, signature;
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const button = (action, label, extra = '') => `<button type="button" data-action="${action}" ${extra}>${label}</button>`;
function render(next) {
  const serial = JSON.stringify(next);
  if (serial === signature) return;
  const sameSession = model?.session === next.session;
  const focusAction = document.activeElement?.dataset?.action;
  const opened = sameSession ? [...app.querySelectorAll('details[open]')].map(e => e.id) : [];
  model = next; signature = serial;
  if (!model) { app.textContent = 'Start a demo case from AITrace: Start Demo.'; return; }
  if (model.stage === 'original') {
    app.innerHTML = `<p class="muted">${escape(model.filename)}</p><h1>Start with your code.</h1>
      <p>${escape(model.task)}</p>
      ${button('request', 'Simulate AI Output', 'class="primary"')}
      <p class="feedback" role="status">${escape(model.feedback)}</p>`;
  } else {
    const change = model.change;
    app.innerHTML = `<div class="topline"><span class="muted">Review changes</span>
      ${button('pin', model.pinned ? 'Pinned to this change' : 'Following code', `class="pin" aria-pressed="${model.pinned}" title="Pin this explanation, or follow the selected code"`)}</div>
      <div class="statusline"><span>${model.reviewed} of ${model.total} reviewed</span><span class="badge ${escape(change.state)}">${escape(change.state)}</span></div>
      <progress value="${model.reviewed}" max="${model.total}" aria-label="Review progress"></progress>
      <label class="muted" for="change">Change ${model.index + 1} of ${model.total}</label>
      <select id="change" aria-label="Choose a change">${model.changes.map(c => `<option value="${escape(c.id)}" ${c.id === change.id ? 'selected' : ''}>${escape(c.title)} - ${escape(c.state)}</option>`).join('')}</select>
      <h1>${escape(change.title)}</h1>
      <div class="location">${button('locate', escape(model.filename) + ' · lines ' + model.startLine + '-' + model.endLine, 'class="text" title="Show the matching code"')}</div>
      ${model.paused ? '<p class="notice">This file was edited manually. Decisions are paused to keep your edits. Start a fresh case or reset this sample.</p>' : ''}
      <div class="decision-bar"><div class="actions">${button('accept', change.state === 'accepted' ? 'Accepted' : 'Accept change', `class="primary" ${model.paused || change.state === 'accepted' ? 'disabled' : ''}`)}
      ${button('reject', change.state === 'rejected' ? 'Rejected' : 'Reject change', model.paused || change.state === 'rejected' ? 'disabled' : '')}</div>
      <p class="feedback" role="status" aria-live="polite">${escape(model.feedback || 'Accept edits and saves this file. Reject keeps or restores the original code.')}</p></div>
      <p class="task"><strong>Task:</strong> ${escape(model.task)}</p>
      <h2>What changed</h2><p>${escape(change.what)}</p><h2>Why</h2><p>${escape(change.why)}</p>
      <div class="diff"><p class="code-label">- Original</p><pre class="before">${escape(change.before.trimEnd())}</pre>
      <p class="code-label">+ Suggested</p><pre class="after">${escape(change.after.trimEnd())}</pre></div>
      <details id="example"><summary>Show an example</summary><p class="muted">Prepared illustration, not an executed test.</p><pre>${escape(change.example)}</pre></details>
      <details id="assumptions"><summary>Assumptions</summary><p>${escape(change.assumption)}</p></details>
      <div class="navigation">${button('previous', 'Previous', model.index === 0 ? 'disabled' : '')}
      ${button('undo', 'Undo decision', model.canUndo && !model.paused ? '' : 'disabled')}
      ${button('next', 'Next', model.index === model.total - 1 ? 'disabled' : '')}</div>`;
  }
  for (const id of opened) { const item = document.getElementById(id); if (item) item.open = true; }
  if (model.expanded) { const item = document.getElementById(model.expanded === 'assumption' ? 'assumptions' : 'example'); if (item) item.open = true; }
  if (focusAction) app.querySelector(`button[data-action="${focusAction}"]:not(:disabled)`)?.focus({ preventScroll: true });
}
app.addEventListener('click', event => {
  const target = event.target.closest('button[data-action]');
  if (!target || target.disabled) return;
  vscode.postMessage({ type: target.dataset.action, changeId: model?.change?.id });
});
app.addEventListener('change', event => {
  if (event.target.id === 'change') vscode.postMessage({ type: 'select', changeId: event.target.value });
});
app.addEventListener('toggle', event => {
  if (['example', 'assumptions'].includes(event.target.id)) vscode.postMessage({ type: 'detail', detail: event.target.id, opened: event.target.open, changeId: model?.change?.id });
}, true);
window.addEventListener('message', event => {
  if (event.data.type === 'state') render(event.data.model);
});
vscode.postMessage({ type: 'ready' });
