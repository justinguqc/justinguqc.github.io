const cases = require('../samples/cases');

class Review {
  constructor(caseId) {
    this.sample = cases.find(item => item.id === caseId);
    if (!this.sample) throw new Error('Unknown sample case');
    this.changes = this.sample.parts.filter(part => typeof part !== 'string');
    this.states = Object.fromEntries(this.changes.map(change => [change.id, 'pending']));
    this.selected = this.changes[0].id;
    this.history = [];
    this.events = [];
    this.log('case_started');
  }
  log(action, data = {}) {
    this.events.push({ time: new Date().toISOString(), action, caseId: this.sample.id, ...data });
  }
  change(id = this.selected) { return this.changes.find(change => change.id === id); }
  select(id) {
    if (!this.change(id)) return false;
    this.selected = id; this.log('change_selected', { changeId: id }); return true;
  }
  decide(id, state) {
    if (!this.change(id) || !['accepted', 'rejected'].includes(state)) return false;
    if (this.states[id] === state) return false;
    this.history.push({ ...this.states });
    this.states[id] = state;
    this.selected = id;
    this.log('decision', { changeId: id, state });
    return true;
  }
  undo() {
    if (!this.history.length) return false;
    this.states = this.history.pop(); this.log('undo'); return true;
  }
  reset() {
    this.states = Object.fromEntries(this.changes.map(change => [change.id, 'pending']));
    this.history = []; this.selected = this.changes[0].id; this.log('case_reset');
  }
  code(version) {
    return this.sample.parts.map(part => typeof part === 'string' ? part :
      version === 'suggested' || (version === 'result' && this.states[part.id] === 'accepted')
        ? part.after : part.before).join('');
  }
  fileDocument() {
    let text = '';
    const ranges = [];
    for (const part of this.sample.parts) {
      if (typeof part === 'string') { text += part; continue; }
      const start = text.length;
      text += this.states[part.id] === 'accepted' ? part.after : part.before;
      ranges.push({ id: part.id, start, end: text.length });
    }
    return { text, ranges };
  }
  reviewDocument() {
    const lines = [
      '# AITrace - ' + this.sample.title,
      '# Task: ' + this.sample.task,
      '# Prepared suggestions. This is a review preview, not your working file.',
      '# + added | - deleted | Pending changes are NOT applied to Result.',
      '# Use Explain change above a block, or hover over its lines.',
      '', '--- original/' + this.sample.filename, '+++ suggested/' + this.sample.filename, ''
    ];
    const ranges = [];
    let index = 0;
    for (const part of this.sample.parts) {
      if (typeof part === 'string') {
        lines.push(...part.replace(/\n$/, '').split('\n').map(line => ' ' + line));
      } else {
        index++;
        const start = lines.length;
        lines.push(`@@ Change ${index}/${this.changes.length}: ${part.title} [${this.states[part.id]}] @@`);
        lines.push(...part.before.replace(/\n$/, '').split('\n').map(line => '-' + line));
        lines.push(...part.after.replace(/\n$/, '').split('\n').map(line => '+' + line));
        ranges.push({ id: part.id, start, end: lines.length - 1 });
        lines.push('');
      }
    }
    return { text: lines.join('\n') + '\n', ranges };
  }
  snapshot() {
    return { caseId: this.sample.id, selected: this.selected, states: { ...this.states },
      reviewed: Object.values(this.states).filter(state => state !== 'pending').length,
      total: this.changes.length, canUndo: this.history.length > 0 };
  }
}
module.exports = { Review, cases };
