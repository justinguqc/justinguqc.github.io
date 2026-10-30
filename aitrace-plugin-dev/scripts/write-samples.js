const fs = require('fs');
const path = require('path');
const { Review, cases } = require('../src/review');
for (const sample of cases) {
  const folder = path.join(__dirname, '..', 'samples', sample.id);
  fs.mkdirSync(folder, { recursive: true });
  const review = new Review(sample.id);
  fs.writeFileSync(path.join(folder, 'original.py'), review.code('original'));
  fs.writeFileSync(path.join(folder, 'suggested.py'), review.code('suggested'));
  fs.writeFileSync(path.join(folder, 'TASK.md'), '# ' + sample.title + '\n\n' + sample.task + '\n\nThese are prepared study examples. Review them in AITrace: Start Demo.\n');
}
