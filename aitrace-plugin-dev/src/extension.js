const vscode = require('vscode');
const path = require('path');
const { Review, cases } = require('./review');
const { panelHtml } = require('./panel');

function activate(context) {
  let review, workingUri;
  let responseReady = false;
  let busy = false;
  let changedOutsideReview = false;
  let panel, panelChangeId;
  let pinned = false;
  let feedback = '';
  const details = new Map();
  const documents = new vscode.EventEmitter();
  const lenses = new vscode.EventEmitter();
  const output = vscode.window.createOutputChannel('AITrace Prototype');
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 20);
  const focusDecoration = vscode.window.createTextEditorDecorationType({ isWholeLine: true,
    borderWidth: '0 0 0 2px', borderStyle: 'solid', borderColor: new vscode.ThemeColor('focusBorder') });
  const decorations = {
    pending: vscode.window.createTextEditorDecorationType({
      backgroundColor: new vscode.ThemeColor('diffEditor.removedTextBackground'),
      overviewRulerColor: new vscode.ThemeColor('editorWarning.foreground') }),
    accepted: vscode.window.createTextEditorDecorationType({ isWholeLine: true,
      backgroundColor: new vscode.ThemeColor('diffEditor.insertedTextBackground') }),
    rejected: vscode.window.createTextEditorDecorationType({ isWholeLine: true,
      borderWidth: '0 0 0 2px', borderStyle: 'solid', borderColor: new vscode.ThemeColor('disabledForeground') })
  };
  const uri = kind => vscode.Uri.from({ scheme: 'aitrace', path: `/${review.sample.id}/${kind}.py` });
  const isWorking = document => Boolean(workingUri && document.uri.toString() === workingUri.toString());
  const ranges = document => review.fileDocument().ranges.map(item => ({ ...item,
    range: new vscode.Range(document.positionAt(item.start), document.positionAt(Math.max(item.start, item.end - 1)))
  }));
  function panelModel() {
    if (!review) return null;
    const id = pinned && review.change(panelChangeId) ? panelChangeId : review.selected;
    const change = review.change(id);
    const layout = review.fileDocument();
    const location = layout.ranges.find(item => item.id === id);
    return { ...review.snapshot(), stage: responseReady ? 'review' : 'original',
      session: workingUri.toString(), filename: review.sample.filename, task: review.sample.task,
      paused: changedOutsideReview, pinned, feedback,
      startLine: layout.text.slice(0, location.start).split('\n').length,
      endLine: layout.text.slice(0, Math.max(location.start, location.end - 1)).split('\n').length,
      index: review.changes.findIndex(item => item.id === id),
      change: { ...change, state: review.states[id] },
      expanded: details.get(id),
      changes: review.changes.map(item => ({ id: item.id, title: item.title, state: review.states[item.id] })) };
  }
  function syncPanel() { if (panel) panel.webview.postMessage({ type: 'state', model: panelModel() }); }
  function ensurePanel(preserveFocus = false) {
    if (panel) { panel.reveal(vscode.ViewColumn.Two, preserveFocus); syncPanel(); return; }
    panel = vscode.window.createWebviewPanel('aitrace.review', 'AITrace',
      { viewColumn: vscode.ViewColumn.Two, preserveFocus },
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [context.extensionUri] });
    context.subscriptions.push(panel);
    panel.onDidDispose(() => { panel = undefined; pinned = false; review?.log('explanation_closed'); decorate(); });
    panel.webview.onDidReceiveMessage(async message => {
      if (!message || typeof message.type !== 'string') return;
      const id = review?.change(message.changeId) ? message.changeId : undefined;
      if (message.type === 'ready') { syncPanel(); return; }
      if (message.type === 'detail' && id && ['example', 'assumptions'].includes(message.detail)) {
        if (message.opened) details.set(id, message.detail === 'example' ? 'example' : 'assumption'); else details.delete(id);
        review.log('detail_opened', { changeId: id, detail: message.detail, opened: message.opened }); syncPanel(); return;
      }
      const map = { accept: 'aitrace.accept', reject: 'aitrace.reject', previous: 'aitrace.previous', next: 'aitrace.next',
        undo: 'aitrace.undo', reset: 'aitrace.reset', export: 'aitrace.export', compare: 'aitrace.compare',
        close: 'aitrace.close', new: 'aitrace.start', select: 'aitrace.explain', pin: 'aitrace.pin', locate: 'aitrace.locate' };
      if (message.type === 'request') {
        await vscode.commands.executeCommand('aitrace.request');
        return;
      }
      if (['accept', 'reject', 'previous', 'next', 'select', 'locate'].includes(message.type) && !id) return;
      if (map[message.type]) await vscode.commands.executeCommand(map[message.type], id);
    });
    panel.webview.html = panelHtml(panel.webview, context.extensionUri);
  }
  function updateStatus() {
    const active = vscode.window.activeTextEditor;
    const onWorking = Boolean(active && isWorking(active.document));
    const attached = onWorking || panel?.active;
    vscode.commands.executeCommand('setContext', 'aitrace.isWorkingFile', onWorking);
    vscode.commands.executeCommand('setContext', 'aitrace.responseReady', responseReady);
    if (!review || !attached) {
      status.text = '$(comment-discussion) AITrace: Start demo'; status.command = 'aitrace.start';
      status.tooltip = 'Open a real sample Python file with prepared AI suggestions.';
    } else {
      const snapshot = review.snapshot();
      status.text = changedOutsideReview ? '$(warning) AITrace: File edited' : !responseReady ? '$(sparkle) AITrace: Simulate AI Output' : `$(checklist) AITrace: ${snapshot.reviewed}/${snapshot.total} reviewed`;
      status.command = responseReady ? 'aitrace.pick' : 'aitrace.request';
      status.tooltip = changedOutsideReview ? 'Manual edits detected. Review decisions are paused to avoid overwriting your edits.' : !responseReady ? `Task: ${review.sample.task}\nSimulate output from a third-party AI to begin reviewing.` : 'Choose a change. Accept edits this file; Reject keeps the current original code.';
    }
    status.show();
  }
  function decorate() {
    for (const editor of vscode.window.visibleTextEditors) {
      for (const [state, decoration] of Object.entries(decorations)) {
        const locations = review && responseReady && isWorking(editor.document) && !changedOutsideReview
          ? ranges(editor.document).filter(item => review.states[item.id] === state).map(item => {
            if (state !== 'pending') return item.range;
            const change = review.change(item.id);
            const proposed = change.after.trimEnd().split('\n');
            return { range: item.range, renderOptions: {
              before: { contentText: '- ', color: new vscode.ThemeColor('gitDecoration.deletedResourceForeground') },
              after: { contentText: `  + ${proposed[0].trim()}${proposed.length > 1 ? ` ... (${proposed.length} lines; full change in explanation)` : ''}`,
                color: new vscode.ThemeColor('gitDecoration.addedResourceForeground'), fontStyle: 'italic' }
            } };
          }) : [];
        editor.setDecorations(decoration, locations);
      }
      const selected = review && panel && responseReady && isWorking(editor.document) && !changedOutsideReview
        ? ranges(editor.document).find(item => item.id === panelModel().change.id) : undefined;
      editor.setDecorations(focusDecoration, selected ? [selected.range] : []);
    }
  }
  function refresh() {
    if (review) {
      for (const kind of ['original', 'suggested']) documents.fire(uri(kind));
      output.appendLine(JSON.stringify(review.snapshot()));
    }
    lenses.fire(); updateStatus(); decorate(); syncPanel();
  }
  async function workingDocument() {
    if (!review) { await start(); if (!review) return; }
    return vscode.workspace.openTextDocument(workingUri);
  }
  async function showWorking(preserveFocus = false) {
    const document = await workingDocument();
    if (!document) return;
    const editor = await vscode.window.showTextDocument(document, { preview: false, viewColumn: vscode.ViewColumn.One, preserveFocus });
    refresh(); return editor;
  }
  async function start(caseId) {
    if (!caseId) {
      const choice = await vscode.window.showQuickPick(cases.map(item => ({
        label: item.title, detail: item.task, id: item.id
      })), { title: 'AITrace - Open a sample file', placeHolder: 'Practice first, then try the Pending task list.' });
      if (!choice) return;
      caseId = choice.id;
    }
    const next = new Review(caseId);
    // A fresh real file per session: never overwrite a sample the user edited.
    const folder = vscode.Uri.file(path.join(context.extensionPath, '.runtime', 'sessions', `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, next.sample.id));
    await vscode.workspace.fs.createDirectory(folder);
    const file = vscode.Uri.joinPath(folder, next.sample.filename);
    await vscode.workspace.fs.writeFile(file, Buffer.from(next.code('original')));
    workingUri = file; review = next; responseReady = false; changedOutsideReview = false; details.clear();
    panelChangeId = review.selected; pinned = false; feedback = '';
    review.log('working_file_opened', { filename: next.sample.filename });
    await showWorking();
    ensurePanel(true);
    vscode.window.setStatusBarMessage(`AITrace task: ${review.sample.task}`, 15000);
    return { ...review.snapshot(), workingUri: workingUri.toString(), stage: 'original' };
  }
  async function request() {
    if (!review) { await start(); if (!review) return; }
    if (responseReady) return;
    const document = await workingDocument();
    if (document.getText() !== review.code('result')) throw new Error('The sample was edited. Start a fresh case to keep your edits, or reset this sample.');
    responseReady = true;
    feedback = `${review.changes.length} prepared suggestions loaded. Choose a change to review.`;
    review.log('ai_output_simulated', { task: review.sample.task });
    review.log('prepared_response_loaded'); refresh();
    const editor = await showWorking(Boolean(panel));
    const first = ranges(editor.document)[0];
    editor.revealRange(first.range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    ensurePanel();
    vscode.window.setStatusBarMessage(`AITrace: ${review.changes.length} prepared suggestion(s) loaded. Original lines stay unchanged until accepted.`, 10000);
    return review.snapshot();
  }
  const link = (label, command, args = []) => `[${label}](command:${command}?${encodeURIComponent(JSON.stringify(args))})`;
  function hoverFor(id) {
    const change = review.change(id);
    const md = new vscode.MarkdownString();
    md.isTrusted = { enabledCommands: ['aitrace.explain'] };
    md.appendText(`AITrace - ${change.title}`);
    md.appendMarkdown('\n\n'); md.appendText(change.what);
    md.appendMarkdown('\n\n' + link('Open AITrace review', 'aitrace.explain', [id]));
    return md;
  }
  async function explain(id) {
    if (!review) { await start(); if (!review) return; }
    if (!responseReady) { ensurePanel(); return; }
    if (id && !review.select(id)) return;
    if (changedOutsideReview) throw new Error('The file was edited manually. Start a fresh demo case or reset it before applying prepared suggestions.');
    const editor = await showWorking(true);
    const target = ranges(editor.document).find(item => item.id === review.selected);
    const position = new vscode.Position(target.range.start.line, editor.document.lineAt(target.range.start.line).firstNonWhitespaceCharacterIndex);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(target.range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    panelChangeId = review.selected;
    review.log('explanation_opened', { changeId: review.selected });
    await vscode.commands.executeCommand('editor.action.hideHover');
    ensurePanel(); decorate();
  }
  async function commit(action) {
    if (!review || !responseReady || busy) return;
    const document = await workingDocument();
    if (busy) return;
    if (document.getText() !== review.code('result')) {
      changedOutsideReview = true; refresh();
      throw new Error('Manual edits detected. Your edits are kept. Start a fresh case or use Reset before continuing.');
    }
    busy = true;
    const previousStates = { ...review.states }, previousHistory = [...review.history];
    try {
      if (!action()) return;
      const next = review.code('result');
      if (document.getText() !== next) {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(workingUri, new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)), next);
        if (!await vscode.workspace.applyEdit(edit)) throw new Error('VS Code could not apply the change. The decision was not saved.');
        await document.save();
      }
      changedOutsideReview = false; refresh();
    } catch (error) {
      review.states = previousStates; review.history = previousHistory; refresh(); throw error;
    } finally { busy = false; }
    await explain(review.selected);
    return review.snapshot();
  }
  async function decide(id, state) {
    const result = await commit(() => review.decide(id || review.selected, state));
    if (result) {
      feedback = state === 'accepted' ? 'Accepted. This file was updated and saved.' : 'Rejected. The original code is kept.';
      syncPanel();
      vscode.window.setStatusBarMessage(`AITrace: ${feedback}`, 5000);
    }
    return result;
  }
  const disposables = [];
  function register(id, fn) {
    disposables.push(vscode.commands.registerCommand(id, async (...args) => {
      try { return await fn(...args); }
      catch (error) { feedback = error.message; syncPanel(); output.appendLine(error.stack || String(error)); vscode.window.showErrorMessage(`AITrace: ${error.message}`); }
    }));
  }
  const frozen = new Map();
  disposables.push(vscode.workspace.registerTextDocumentContentProvider('aitrace', {
    onDidChange: documents.event,
    provideTextDocumentContent(resource) {
      if (!review || !resource.path.startsWith(`/${review.sample.id}/`)) return frozen.get(resource.toString()) || '';
      const kind = resource.path.split('/').pop().split('.')[0];
      const text = review.code(kind); frozen.set(resource.toString(), text); return text;
    }
  }));
  disposables.push(vscode.languages.registerCodeLensProvider({ scheme: 'file', language: 'python' }, {
    onDidChangeCodeLenses: lenses.event,
    provideCodeLenses(document) {
      if (!isWorking(document) || changedOutsideReview) return [];
      if (!responseReady) return [new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
        title: 'AITrace: Simulate AI Output', command: 'aitrace.request'
      })];
      const snapshot = review.snapshot();
      return [new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
        title: `AITrace · ${snapshot.total - snapshot.reviewed} pending changes · Open review`, command: 'aitrace.explain'
      }), ...ranges(document).map((item, index) => {
        const range = new vscode.Range(item.range.start, item.range.start), state = review.states[item.id];
        return new vscode.CodeLens(range, { title: `AITrace · Review change ${index + 1}/${snapshot.total} · ${state}`, command: 'aitrace.explain', arguments: [item.id] });
      })];
    }
  }));
  disposables.push(vscode.languages.registerHoverProvider({ scheme: 'file', language: 'python' }, {
    provideHover(document, position) {
      if (!isWorking(document) || !responseReady || changedOutsideReview) return;
      const item = ranges(document).find(item => item.range.contains(position));
      if (item) return new vscode.Hover(hoverFor(item.id), item.range);
    }
  }));
  register('aitrace.start', start);
  register('aitrace.request', request);
  register('aitrace.close', async id => {
    panel?.dispose();
    await vscode.commands.executeCommand('editor.action.hideHover');
    if (review) await showWorking();
  });
  register('aitrace.pin', () => {
    if (!review) return;
    if (!pinned) panelChangeId = review.selected;
    pinned = !pinned; review.log('explanation_pin_changed', { pinned }); syncPanel(); decorate();
    return pinned;
  });
  register('aitrace.locate', async id => {
    if (!review?.change(id) || changedOutsideReview) return;
    const editor = await showWorking();
    const target = ranges(editor.document).find(item => item.id === id);
    editor.selection = new vscode.Selection(target.range.start, target.range.end);
    editor.revealRange(target.range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    review.select(id); syncPanel(); decorate();
  });
  register('aitrace.explain', explain);
  register('aitrace.accept', id => decide(id, 'accepted'));
  register('aitrace.reject', id => decide(id, 'rejected'));
  register('aitrace.more', async (id, detail) => {
    if (!review?.change(id) || !['example', 'assumption', 'summary'].includes(detail)) return;
    if (detail === 'summary') details.delete(id); else details.set(id, detail);
    review.log('detail_opened', { changeId: id, detail }); await explain(id);
  });
  const move = async (direction, id) => {
    if (!review) return start();
    const index = review.changes.findIndex(item => item.id === (id || review.selected));
    await explain(review.changes[Math.max(0, Math.min(review.changes.length - 1, index + direction))].id);
  };
  register('aitrace.previous', id => move(-1, id));
  register('aitrace.next', id => move(1, id));
  register('aitrace.result', async () => { const editor = await showWorking(); review?.log('working_file_viewed'); return editor?.document.getText(); });
  register('aitrace.compare', async () => {
    if (!review) { await start(); if (!review) return; }
    if (!responseReady) { await request(); if (!responseReady) return; }
    await vscode.commands.executeCommand('vscode.diff', uri('original'), uri('suggested'), 'AITrace: Original ↔ All suggestions');
  });
  register('aitrace.pick', async () => {
    if (!review) return start();
    if (!responseReady) return request();
    const choice = await vscode.window.showQuickPick(review.changes.map((item, index) => ({ label: `${index + 1}. ${item.title}`, description: review.states[item.id], id: item.id })), { title: 'AITrace - Choose a change' });
    if (choice) await explain(choice.id);
  });
  register('aitrace.undo', async () => {
    const result = await commit(() => review.undo());
    if (result) { feedback = 'Last decision undone. The code was restored and saved.'; syncPanel(); }
    return result;
  });
  register('aitrace.reset', async (confirmed = false) => {
    if (!review) return start();
    if (!confirmed && await vscode.window.showWarningMessage('Reset this sample file? Review decisions and any manual edits in this sample will be cleared.', { modal: true }, 'Reset sample') !== 'Reset sample') return;
    const document = await workingDocument();
    busy = true;
    try {
      const edit = new vscode.WorkspaceEdit();
      edit.replace(workingUri, new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)), review.code('original'));
      if (!await vscode.workspace.applyEdit(edit)) throw new Error('Could not reset the sample file.');
      review.reset(); responseReady = false; details.clear(); changedOutsideReview = false;
      pinned = false; panelChangeId = review.selected; feedback = 'Sample reset. You can simulate AI output again.';
      await document.save(); refresh();
    } finally { busy = false; }
    await showWorking(); return review.snapshot();
  });
  register('aitrace.export', async () => {
    if (!review) return start();
    const target = await vscode.window.showSaveDialog({ title: 'Save AITrace session log', filters: { JSON: ['json'] }, defaultUri: vscode.Uri.joinPath(vscode.Uri.file(path.dirname(workingUri.fsPath)), 'session-log.json') });
    if (!target) return;
    await vscode.workspace.fs.writeFile(target, Buffer.from(JSON.stringify({ prototype: 'AITrace 0.4.2', snapshot: review.snapshot(), events: review.events }, null, 2)));
    vscode.window.showInformationMessage('Session log saved locally.');
  });
  disposables.push(vscode.window.onDidChangeActiveTextEditor(() => { updateStatus(); decorate(); }),
    vscode.window.onDidChangeVisibleTextEditors(decorate),
    vscode.workspace.onDidChangeTextDocument(event => {
      if (!isWorking(event.document) || busy) return;
      changedOutsideReview = event.document.getText() !== review.code('result'); refresh();
    }),
    vscode.window.onDidChangeTextEditorSelection(event => {
      if (!isWorking(event.textEditor.document) || changedOutsideReview) return;
      const item = ranges(event.textEditor.document).find(item => item.range.contains(event.selections[0].active));
      if (item && item.id !== review.selected) { review.select(item.id); syncPanel(); decorate(); }
    }));
  context.subscriptions.push(...disposables, ...Object.values(decorations), focusDecoration, documents, lenses, output, status);
  updateStatus();
  return { snapshot: () => review ? { ...review.snapshot(), workingUri: workingUri.toString(), paused: changedOutsideReview, stage: responseReady ? 'review' : 'original' } : undefined,
    panelState: () => ({ open: Boolean(panel), model: panelModel() }) };
}
module.exports = { activate };
