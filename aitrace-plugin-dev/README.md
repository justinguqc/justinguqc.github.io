# AITrace

AITrace helps you find and understand AI code changes. Related edits form a group that you accept, reject, or undo together. In the Pending example, filtering and counting belong together; sorting stays separate.

To try it, run **AITrace: Start Demo**, choose a sample, and click **Simulate AI Output**. Use **Previous** and **Next** to explore changes, or **Undo decision** to revisit a choice.

Hover over a highlighted block to compare its original and replacement code. The review panel brings the explanation and effect together, with fixed review controls and accepted, rejected, and pending group counts. **Pin this group** keeps it open while you select other code; **Pinned · Unpin** resumes following your selection. Previous, Next, and the group picker still let you move deliberately while pinned.

Uncheck **Show inline previews** to hide replacement markers without losing highlights, hover previews, or review links.

This prototype uses prepared examples and works offline.

Long or multiline replacements use a short inline marker; open the review panel to read the full code.

Undo opens the group whose decision it reversed and names it in the feedback. Messages clear when you move to another group or resolve a manual edit. When review pauses, you can browse the saved comparison without changing your edited file. **Start fresh case** opens a new copy of the same sample; **Reset sample** asks for confirmation before clearing sample edits and decisions.
