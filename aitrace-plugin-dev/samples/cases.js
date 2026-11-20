// Prepared suggestions and explanations. No network calls or generated answers.
module.exports = [
  {
    id: 'practice', title: 'Practice - Course result', filename: 'course_result.py',
    task: 'A score of 60 or more should pass. Review the proposed pass/fail check.',
    parts: [
      'def course_result(score):\n',
      { id: 'pass-check', title: 'Replace the placeholder with a pass/fail check',
        type: 'Bug fix',
        before: '    return "Not checked"\n',
        after: '    return "Pass" if score >= 60 else "Fail"\n',
        what: 'Replace the placeholder result with a check against the passing score.',
        why: 'The requirement says 60 or above passes. Using >= includes exactly 60.',
        effect: 'Return Pass for scores of 60 or more, and Fail for lower scores, instead of always returning Not checked.',
        example: '59 -> Fail\n60 -> Pass\n61 -> Pass',
        assumption: 'score is a number. Input validation is outside this prepared example.' },
      '\nprint(course_result(60))\n'
    ]
  },
  {
    id: 'todo', title: 'Review - Pending task list', filename: 'pending_tasks.py',
    task: 'Show only incomplete tasks in Pending, and make its counter match that list. Keep the existing task order.',
    parts: [
      'tasks = [\n    {"title": "Read notes", "completed": False},\n    {"title": "Send email", "completed": True},\n    {"title": "Buy food", "completed": False},\n]\n\n',
      { id: 'pending-fix', title: 'Keep Pending and its count in sync',
        edits: 2,
        type: 'Bug fix',
        before: 'pending = tasks\nremaining = len(tasks)\n',
        after: 'pending = [\n    task for task in tasks if not task["completed"]\n]\nremaining = len(pending)\n',
        what: 'Filter out completed tasks and count the filtered list.',
        why: 'The list and counter describe the same tasks, so these two edits belong together.',
        effect: 'Pending contains Read notes and Buy food, in their original order. Send email is excluded and the counter shows 2.',
        example: 'Read notes (False) -> kept\nSend email (True) -> excluded\nBuy food (False) -> kept',
        assumption: 'Every task has a Boolean completed field. The remaining-task count should use the same filtered list.' },
      { id: 'sort-tasks', title: 'Sort the task list alphabetically',
        type: 'Behaviour change',
        before: 'visible = pending\n', after: 'visible = sorted(pending, key=lambda task: task["title"])\n',
        what: 'Sort the displayed tasks by title.',
        why: 'The prepared suggestion tries to make titles easier to scan, but this changes the original task order.',
        effect: 'Buy food appears before Read notes. This conflicts with the task requirement to keep the original order.',
        example: 'Read notes, Buy food -> Buy food, Read notes\nCompare this with the requirement to keep the existing order.',
        assumption: 'This is an optional suggestion, not a required part of the Pending fix. You can reject it.' },
      '\nprint(f"Remaining: {remaining}")\nfor task in visible:\n    print(task["title"])\n'
    ]
  }
];
