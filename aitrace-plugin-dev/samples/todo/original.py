tasks = [
    {"title": "Read notes", "completed": False},
    {"title": "Send email", "completed": True},
    {"title": "Buy food", "completed": False},
]

pending = tasks
remaining = len(tasks)
visible = pending

print(f"Remaining: {remaining}")
for task in visible:
    print(task["title"])
