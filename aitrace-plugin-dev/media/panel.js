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
  const sameChange = sameSession && model?.change?.id === next.change?.id;
  const scrollTop = sameChange ? document.getElementById('review-body')?.scrollTop || 0 : 0;
  const focusAction = document.activeElement?.dataset?.action;
  const focusId = document.activeElement?.id;
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
    app.innerHTML = `<div class="review-controls" aria-label="Review controls">
      <div class="topline"><span class="muted">Review groups</span>
      ${button('pin', model.pinned ? 'Pinned · Unpin' : 'Pin this group', `class="pin" aria-pressed="${model.pinned}" title="${model.pinned ? 'Unpin to follow the selected code again' : 'Keep this group open when selecting other code'}"`)}</div>
      <div class="statusline"><span>${model.reviewed} of ${model.total} groups reviewed</span><span class="badge ${escape(change.state)}"><span aria-hidden="true">${change.state === 'accepted' ? '✓' : change.state === 'rejected' ? '×' : '○'}</span> ${escape(change.state)}</span></div>
      <p class="counts" aria-live="polite"><span><strong class="accepted">${model.counts.accepted}</strong> accepted</span><span><strong>${model.counts.rejected}</strong> rejected</span><span><strong class="pending">${model.counts.pending}</strong> pending</span></p>
      <progress value="${model.reviewed}" max="${model.total}" aria-label="Review progress"></progress>
      <label class="muted" for="change">Group ${model.index + 1} of ${model.total}</label>
      <select id="change" aria-label="Choose a change">${model.changes.map(c => `<option value="${escape(c.id)}" ${c.id === change.id ? 'selected' : ''}>${escape(c.title)} - ${escape(c.state)}</option>`).join('')}</select>
      <div class="actions">${button('accept', '<span aria-hidden="true">✓</span> ' + (change.state === 'accepted' ? 'Accepted' : 'Accept group'), `class="primary" ${model.paused || change.state === 'accepted' ? 'disabled' : ''}`)}
      ${button('reject', '<span aria-hidden="true">×</span> ' + (change.state === 'rejected' ? 'Rejected' : 'Reject group'), `class="reject" ${model.paused || change.state === 'rejected' ? 'disabled' : ''}`)}</div>
      <div class="navigation">${button('previous', 'Previous', model.index === 0 ? 'disabled' : '')}
      ${button('undo', 'Undo decision', model.canUndo && !model.paused ? '' : 'disabled')}
      ${button('next', 'Next', model.index === model.total - 1 ? 'disabled' : '')}</div>
      <div class="preview-switch"><label for="inline-previews"><input id="inline-previews" type="checkbox" ${model.inlinePreviews ? 'checked' : ''}> Show inline previews</label></div>
      </div>
      <div id="review-body" class="review-body" tabindex="0" aria-label="Change explanation">
      <p class="feedback" role="status" aria-live="polite">${escape(model.feedback || 'Choose a change to review.')}</p>
      <h1>${escape(change.title)}</h1>
      <p class="pin-context ${model.pinned ? 'is-pinned' : ''}">${model.pinned ? `Pinned to Group ${model.index + 1} · code selection won't switch this review.` : 'Following code selection · pin to keep this group open.'}</p>
      <div class="location">${button('locate', escape(model.filename) + ' · lines ' + model.startLine + '-' + model.endLine, 'class="text" title="Show the matching code"')}</div>
      ${model.paused ? '<p class="notice">This file was edited manually. Decisions are paused to keep your edits. Start a fresh case or reset this sample.</p>' : ''}
      <p class="group-meta"><span class="change-type">${escape(change.type || 'Code change')}</span> <span>${change.edits || 1} ${(change.edits || 1) === 1 ? 'edit' : 'related edits'} · one decision</span></p>
      <section class="explanation"><h2>Change &amp; purpose</h2><p>${escape(change.what)} ${escape(change.why)}</p>
      <section class="effect"><h2>Effect</h2><p>${escape(change.effect || change.what)}</p></section>
      <p id="assumptions"><strong>Assumptions:</strong> ${escape(change.assumption)}</p></section>
      <div class="diff"><p class="code-label">Original</p><pre class="before">${escape(change.before.trimEnd())}</pre>
      <p class="code-label">Suggested replacement</p><pre class="after">${escape(change.after.trimEnd())}</pre></div>
      <details id="example"><summary>Show an example</summary><p class="muted">Prepared illustration, not an executed test.</p><pre>${escape(change.example)}</pre></details>
      <details class="task"><summary>Task reference</summary><p>${escape(model.task)}</p></details>
      </div>`;
  }
  for (const id of opened) { const item = document.getElementById(id); if (item) item.open = true; }
  if (model.expanded) { const item = document.getElementById(model.expanded === 'assumption' ? 'assumptions' : 'example'); if (item) item.open = true; }
  if (focusAction) app.querySelector(`button[data-action="${focusAction}"]:not(:disabled)`)?.focus({ preventScroll: true });
  else if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
  const reviewBody = document.getElementById('review-body');
  if (reviewBody) reviewBody.scrollTop = scrollTop;
}
app.addEventListener('click', event => {
  const target = event.target.closest('button[data-action]');
  if (!target || target.disabled) return;
  vscode.postMessage({ type: target.dataset.action, changeId: model?.change?.id });
});
app.addEventListener('change', event => {
  if (event.target.id === 'change') vscode.postMessage({ type: 'select', changeId: event.target.value });
  if (event.target.id === 'inline-previews') vscode.postMessage({ type: 'previews' });
});
app.addEventListener('toggle', event => {
  if (['example', 'assumptions'].includes(event.target.id)) vscode.postMessage({ type: 'detail', detail: event.target.id, opened: event.target.open, changeId: model?.change?.id });
}, true);
window.addEventListener('message', event => {
  if (event.data.type === 'state') render(event.data.model);
});
vscode.postMessage({ type: 'ready' });
