tasks = [
    {"title": "Read notes", "completed": False},
    {"title": "Send email", "completed": True},
    {"title": "Buy food", "completed": False},
]

pending = [
    task for task in tasks if not task["completed"]
]
remaining = len(pending)
visible = sorted(pending, key=lambda task: task["title"])

print(f"Remaining: {remaining}")
for task in visible:
    print(task["title"])
