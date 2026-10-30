// Prepared suggestions and explanations. No network calls or generated answers.
module.exports = [
  {
    id: 'practice', title: 'Practice - Course result', filename: 'course_result.py',
    task: 'A score of 60 or more should pass. Review the proposed pass/fail check.',
    parts: [
      'def course_result(score):\n',
      { id: 'pass-check', title: 'Replace the placeholder with a pass/fail check',
        before: '    return "Not checked"\n',
        after: '    return "Pass" if score >= 60 else "Fail"\n',
        what: 'Replace the placeholder result with a check against the passing score.',
        why: 'The requirement says 60 or above passes. Using >= includes exactly 60.',
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
      { id: 'pending-filter', title: 'Exclude completed tasks',
        before: 'pending = tasks\n',
        after: 'pending = [\n    task for task in tasks if not task["completed"]\n]\n',
        what: 'Build Pending from tasks whose completed value is False.',
        why: 'The current list includes completed tasks. Filtering keeps only the unfinished ones.',
        example: 'Read notes (False) -> kept\nSend email (True) -> excluded\nBuy food (False) -> kept',
        assumption: 'Every task has a Boolean completed field. The remaining-task count should use the same filtered list.' },
      { id: 'pending-count', title: 'Count the same tasks that Pending displays',
        before: 'remaining = len(tasks)\n', after: 'remaining = len(pending)\n',
        what: 'Count pending instead of the full tasks list.',
        why: 'The displayed count should describe the displayed Pending list.',
        example: 'With the filter accepted: 2 pending tasks -> count 2.\nWith the filter rejected: pending still includes all 3 tasks -> count 3.',
        assumption: 'This count depends on the value assigned to pending. Review the filter too.' },
      { id: 'sort-tasks', title: 'Sort the task list alphabetically',
        before: 'visible = pending\n', after: 'visible = sorted(pending, key=lambda task: task["title"])\n',
        what: 'Sort the displayed tasks by title.',
        why: 'The prepared suggestion tries to make titles easier to scan, but this changes the original task order.',
        example: 'Read notes, Buy food -> Buy food, Read notes\nCompare this with the requirement to keep the existing order.',
        assumption: 'This is an optional suggestion, not a required part of the Pending fix. You can reject it.' },
      '\nprint(f"Remaining: {remaining}")\nfor task in visible:\n    print(task["title"])\n'
    ]
  }
];
