# Balamentum – User Guide

Welcome to **Balamentum**. The app answers a single question:
_"What should I work on next?"_ – especially when tasks depend on each other
and at the same time contribute to different areas of life.

Two ideas are behind it:

- **Value instead of gut feeling.** From the priority and the weighted
  dependencies, Balamentum calculates a value for each task. This makes the most
  valuable tasks and the sensible next task visible.
- **Life balance pillars.** Every task contributes to the areas of life: you tap the pillars
  in order of their importance – the app distributes the shares accordingly (staircase
  50/20/15/10/5, the rest is split evenly). The five pillars are fixed. With the
  weighting in the settings you control which areas matter right now – and see
  whether your time flows there.

This guide explains all features of the app.

---

## Sign-in

Balamentum is a personal tool – your data is tied to your account:

- On the start page, click **"Sign in with Google"** – after signing in
  you land directly on the dashboard.
- If sign-in by email is enabled, there is also a field
  **"Sign-in link by email"** below it: enter your address, click **"Send sign-in link"**
  and open the link from the email. It is valid for 15 minutes and works
  exactly once.

Access is limited to approved email addresses. There is no separate registration:
your account is created automatically on your first successful sign-in. If your
address is not approved, a sign-in error appears and no account is created – in that
case, contact the administrator. How the operator approves addresses is described in
[auth-setup.md](auth-setup.md).

You can **log out** at any time via the header (icon on the far right).

---

## Overview: header and views

At the very top you find the **header actions**:

- **Go to dashboard** (house) – back to the dashboard.
- **Search** (magnifier) – searches your tasks by title and filters by category.
- **Create new task** (plus) – the central entry point for new tasks _and_ series.
- **Settings** (gear) – appearance, voice input, push, location, pillar weighting, AI (providers and access tokens), groups, categories.
- **Help** (question mark) – this guide.
- **Logout** – ends the session.

Next to it on the right you see your profile picture.

The header is the same on all screen sizes: all icon buttons sit directly in the bar – there is no additional menu. While scrolling, the bar stays visible, with some spacing from the content so both remain easy to read.

Below it, a **tab bar** lets you switch between the five main views:

1. **Dashboard** – overview and recommendations
2. **Tasks** – create and maintain your tasks; a toggle here switches
   between **open** and **completed** tasks
3. **Series & templates** – recurring tasks and templates
4. **Graph** – your tasks as a graph with weighted dependencies
5. **Journal** – record short entries with a date and optionally a pillar, edit
   and delete them

---

## Dashboard

The dashboard is the start page and display only. If a name is stored,
it greets you with **"Hello {name}!"**. As long as you have no tasks yet, the app
shows a card with the button **"Create first task"** instead. From top to bottom:

- **My life balance:** an image shows how evenly your completed
  tasks of the last four weeks are spread across your pillars – each pillar has
  a weekly target for this (Body 5, Impact 5, Mental health 3, Relationships 3, Meaning 1
  completions per week; this is also stated in the pillar descriptions under Settings → Pillars). 100 % means every pillar is on its target; 0 % means
  everything hangs on a single pillar. Which image you see is chosen in the
  settings under **"Life balance image"** – **Heart**, **Bubbles**,
  **Discs**, **Rings**, **Rays**, **Blossom**, **Crystal**, **Segments** or **Hands**. All of them show the same numbers: for each pillar,
  the size stands for the ratio of actual to target, and the strongest pillar gets the
  largest shape. "Bubbles" and "Discs" show the same stack – once
  translucent and glowing, once solid and sharp-edged. "Blossom" and
  "Crystal" combine all pillars into one shared silhouette whose
  lobes reach as far per pillar as its value – once soft, once angular. "Segments"
  divides the ring by actual shares, "Hands" shows one hand per pillar on the dial.
  Around these eight
  images runs a dial of
  100 ticks that changes from dark red via orange to dark green – the
  lit ticks are your balance score in percent. A strongly neglected pillar pushes the
  score down more clearly than many small deviations. The legend lists, for each pillar, the
  actual share, the target and the deviation in percentage points (`pp`), and the text
  below the number says which pillar is falling behind and which is pulling ahead.
- **Status tiles:** **Total**, **Open** and **Completed** – the number of your
  tasks at a glance.
- **Care hint:** if a pillar is getting too little attention, a suggestion for it appears above the next
  task. If one pillar carries most of your effort (overload), the
  hint suggests balance or a break instead. With Plus or Pro, the suggestion can
  come from the AI based on your previous tasks; it is then labeled **"AI suggestion"**,
  and "Decline suggestion" hides it until the end of the day. **"Accept suggestion"** creates it as a task (an existing task
  is set to "In process"), **"Not now"** hides the hint until the end of the day,
  **"Decline suggestion"** for 14 days. If there is no suggestion, a short
  message appears there.
- **Next task:** the task with the highest priority whose predecessors are all
  completed.
  With **"Complete"** you finish it directly in a dialog; next to it is an
  **edit button** (pencil icon) that opens the task form. If nothing is due,
  a hint appears (everything done or blocked by open predecessors).
- **What's next?** A numbered list of suggestions (limited on the server to
  at most five entries, of which at most two per pillar). The task already shown as "Next
  task" does not appear here again.
- **Free time:** only with a connected calendar – the free gaps from now until 10 pm
  with up to three open tasks whose effort fits in (low effort ≈ 15 minutes,
  highest ≈ 2 hours). Without a suitable gap, the card does not appear.
- **Nearby:** open tasks with a location, sorted by ascending distance from
  your current position (limited on the server to at most ten entries).
  Each entry shows the title and the distance in kilometers; the card title shows the
  configured display distance. The card only appears while
  location tracking is enabled in the settings – if it is off, the card is
  missing entirely. If the browser denies location access, the card stays
  and shows a hint instead. The card and reminders belong to the Plus and Pro
  plans (see "Plans").
- **Top tasks:** the top 5 by calculated **value**.
- **My topics:** one progress bar per pillar that compares the **actual share**
  (where your effort goes) with the pillar's **target weighting**. Below it, the
  number of contributing tasks (open/completed), proportional value and effort.
- **Streak:** how many days in a row you recently completed something, plus your
  best mark. An expandable hint "How the streak counts" explains the counting rule.
- **Milestones:** the reached and still open levels for streak and points
  (see "Completed tasks and points").
- **Missed tasks:** counts how many tasks were deleted automatically after a missed
  deadline and lists up to three of the most recently cleaned-up titles (see
  "Automatic deletion after a missed deadline").
- **"Missed" section:** overdue open tasks without auto-delete are collected
  above the task list — with a postpone counter and the actions "Done" (asks: "Task only completed now?" – "Yes, now" counts as late, "No, on time" books the completion on the deadline), "Reschedule",
  "Archive" and "Delete" (on Dashboard and Tasks). Archived tasks disappear from the
  list and the section; you find them on the Tasks page with the "Show archived" toggle
  and bring them back there with "Restore". Not to be confused with the "Missed
  tasks" card above — that one only counts automatic deletions.
- **Day done:** a short hint that appears when no task is open anymore
  and your last completion was today.
- **Total credit:** your score from completed tasks, broken down by
  pillar (see "Completed tasks and points").
- **Upcoming deadlines:** open tasks with a due date, sorted by date.
  A colored badge warns about **overdue** (red) and **due soon**
  (orange, today up to 3 days ahead) tasks.

Above the cards you switch between **Today** and **Week**. The
week view shows the current calendar week as seven day cards (Monday first) with
the open tasks due on that day; completed ones appear struck through
below. Events from a connected calendar (see "Calendar" under Settings → General)
appear above the tasks of their day, with a time or as "all day". Under Today you also see the
recommended tasks and the next task. With **"Open day"** you jump to the
Tasks tab and see that day's tasks there.

---

## Managing tasks

In the **Tasks** tab your tasks appear as a **flat list of actionable leaf tasks**.
These are exactly the tasks that have **no subtasks** – the tasks
you can actually do right now without anything else having to be done first.
You find the overview of all dependencies in the **Graph** tab.

At the top of the tab you find four switches and the filter row below them:

- a **"Show completed tasks" toggle** that switches between the list of open
  tasks and the table of completed tasks,
- a **"Show archived" toggle** that shows the archived tasks – each entry
  with "Restore" and "Delete" (it and "Show completed tasks"
  turn each other off),
- a **"Balance prioritization" switch** – re-sorts the open list so that tasks
  contributing to your so far neglected pillars move to the top. The priority
  badge then shows a derived level with a tilde (`~P1` to `~P5`) instead of the actual
  priority; after switching it off, it shows the usual `P1` to `P5` again. The sorting
  uses your current state: when you check off a task, the list reorders immediately.
  Your tasks themselves are not changed, only the order in which they are displayed,
- a **"Show parent tasks" switch** – additionally includes the tasks in the list
  that have subtasks themselves,
- a **search field** that filters the current view by **title** (partial matches,
  case-insensitive). The filter only applies when you click **"Filter"**
  or press Enter. The search text is kept when you switch views; if nothing matches,
  an empty-state hint appears, and
- a **category filter** next to it, as soon as you have created categories. A selection takes effect
  immediately, without going through "Filter".

In addition, the **magnifier in the header** opens a search window: enter a term
(optionally by voice), choose a **category** if needed and start the search – the app
then switches to the Tasks tab and applies the term and category as filters. Both
appear in the address bar (`?q=` and `?cat=`), so bookmarks and the back button
restore them.

If you dictate the query and AI features are active, the app breaks it down before searching:
"open stuff for the house build" becomes the search term "open stuff" plus the category
"House build". If that doesn't work, it simply searches with the spoken text.

On the right of each row there can be **badges**:

- **For: {name}** or **Created by: {name}** – for tasks you created for a
  group member or that someone created for you (see "Groups").
- **Category** – the colored badge with the name of the category (see "Categories").
- **Draft / Summary / Research** – this is where the AI could do some groundwork; the app detects this from the title and
  description, without sending anything to the AI. Only visible with the AI plan feature.
- **Series** (repeat symbol) – the task comes from a series.
- **modified** – a series instance that you have edited individually.
- **Progress** as `completed/total` – only for tasks with subtasks; counts
  all subtasks underneath.
- **Priority** as `P1` to `P5` – the color indicates importance: P1 blue,
  P2 and P3 orange, P4 and P5 red.
- **Location** (globe) – the task has a location (address or
  coordinates). The
  badge also appears in the series list and the completed list.

### Actions per task

All actions are behind a **"More actions" menu** (three-dot button) at the end of the row.
In the menu you find:

- **Done / Reopen** – the first entry, toggles the status. For tasks
  with open subtasks the entry is called "Done (subtasks open)" and stays
  disabled until they are completed – you only see such tasks with the
  "Show parent tasks" switch. Reopening is possible at any time – also as a quick
  undo right after completing.
- **Edit** (pencil) – opens the task form.
- **Dependencies** (chain) – opens the predecessor editor.
- **Create subtask** (plus) – creates a new task that is automatically linked to the
  current one as a predecessor.
- **Pin / Unpin** (pin) – keeps a task permanently at the top of the list,
  regardless of sorting; a pin symbol marks it in the row. Unpin
  returns it to the normal sorting.
- **Delete** (cross) – removes the task after confirmation.

Freshly completed tasks stay "sticky" in the open tree for **5 seconds** (for an
immediate undo via "Reopen"). After that, the view reloads automatically and the
task appears in the **Completed** view.

---

## Creating tasks

You always create new tasks via **"Create new task"** in the header.
The process has two steps. If you have turned off the AI features in the settings,
the first step is skipped and the form opens directly:

### Step 1 – Quick capture

Describe your task freely in the **"Describe your task"** field, e.g.:
_"Finish the client report by Friday, high priority, about half a day."_

Then you have four options:

- **Process and continue** – an AI reads the text and pre-fills title, description,
  priority, effort, deadline, address, checklist and category in the form.
  If it detects a recurring event, the form opens straight in series mode.
- **Get advice** – the pillar advisor answers in the same dialog (see "Pillar advisor").
- **From template** – picks a template (a series without "Create automatically") and opens the
  "Create task" dialog, pre-filled with the template's title, priority and description.
  Without templates, the dialog shows how to create one in the "Series & templates" tab.
- **Skip** – opens the empty form directly; any text already entered
  moves into the description.

### Step 2 – Form

The task form appears in the same dialog. Fields:

- **Title** (required, max. 65 characters) – a short, concise name. A counter on the
  field shows the current number of characters.
- **Priority** – slider, whole number from **1 to 5** (default 3). Higher =
  more important; feeds directly into the value.
- **Estimated effort in days** – slider from **0.1 to 1** (default 0.5).
- **Deadline (optional)** – due date. Only the calendar day counts,
  regardless of time zone.
- **Address (optional)** – a location for the task. While you type,
  the app suggests matching addresses; if you choose one, the
  corresponding coordinates are saved and shown below the field. You can
  also keep free text without a match – then there are no coordinates
  and the task does not appear in the "Nearby" list. At the very top of the
  suggestion list are your saved places (see "Saved places"),
  below them the search results. With the star next to a search result you save it as a
  saved place without selecting it. With **"Save as favorite"**
  below the field you save the address currently entered – including its
  coordinates if it comes from a search result. The address field works the same way
  for series.
- **Description (optional)** – further context, max. 3000 characters.
- **Checklist (optional)** – break the task down into steps you can check off.
  Entries can be added, checked off and removed.
- **Automatic deletion (optional)** – automatically delete the task 3 days after a missed
  deadline (only available when a deadline is set; always available for series,
  since the start date serves as the due date).
- **Copy editing** – with a button next to title and description you can ask the AI
  to improve the text (shortening, smoothing, spelling). A diff dialog shows the
  comparison; you decide whether to accept the suggestion.
- **AI draft** – if a task is marked as suitable for AI (drafting, summarizing,
  researching), "Edit task" offers a matching action at the bottom. Only your click has
  the AI create a draft; it is kept separate from the description and can be deleted.
- **Category (optional)** – the topic the task belongs to (see "Categories").
  At most one per task; it only organizes, it does not change prioritization.
- **Pillar distribution** – how strongly the task contributes to the areas of life. You tap the
  pillars in order of their importance; rank and share are shown on each pillar
  (see "Life balance pillars").
- **Recipient** – who the task is for: yourself or a member
  of one of your groups (see "Groups"). The field appears as long as you are a member
  of at least one group. If you choose another account while **editing**,
  you hand the task over when you save – afterwards you only see it with
  the "For: {name}" badge. A hint below the field tells you this beforehand.

Save with **"Create"** (or **"Edit"**), discard with **"Cancel"**.

> **Task or series?** When creating, there is a **"Series or template"** switch at the top.
> Off = one-time task, on = recurring series or template (see "Series").

---

## Checklist

In the task form you can create a **checklist**. It lets you break a task down
into individual steps you can check off:

- **Add:** enter text and click **"Add"** – the new entry
  appears in the list.
- **Check off:** a switch per entry toggles between done / open.
- **Remove:** the cross button deletes the entry.

The checklist is saved with the task and is there again when you edit it.
It does not feed into the value calculation; it is purely for overview.

---

## Automatic deletion after a missed deadline

If you enable **"Delete automatically after 3 days if the deadline is missed"** in the form
(checkbox, only visible when a deadline is set), the task is deleted automatically **3 days after
the deadline has passed** – **but only if it has not been completed by then**.

This also applies to series instances: if the option is set in the series template,
all instances generated from then on inherit this setting. In series mode the
option is always available, since the series' start date serves as the due date.

---

## Copy editing

Next to the **title** and **description** fields you find a button with a
magic wand icon each: **"Edit title"** and **"Edit description"**.

- A click sends the current text to the AI – to the provider that is enabled in the
  settings.
- The AI returns an improved suggestion (shortening, smoothing, spelling).
- A **diff dialog** shows the comparison side by side (original ↔ suggestion).
- You accept the suggestion with **"Apply"** or cancel – the original text
  is then kept.

Copy editing is independent of quick capture and can be used at any time.

---

## Voice input

Text fields such as **title**, **description**, the free-text field of **quick capture**
and the search field of the header search can be filled by voice –
provided your browser supports speech recognition.

- A **microphone button** appears in the field. One click starts recording,
  another stops it. Recognized text is appended to the existing content.
- Speech is recognised in the interface language (German or English).
- Optionally, recording starts **automatically** in the voice fields – the title field in the
  task form, quick capture and search – enabled
  via _Settings → General → "Auto-start voice recording"_.
- When creating and searching, the AI also detects the **category** from the spoken text,
  provided you have created some (see "Categories").

---

## Dependencies (predecessors)

Tasks can depend on each other: a **predecessor** must be completed before the
dependent task can sensibly be started. To do so, open the **"More actions"
menu** (three-dot button) of a task and choose **"Dependencies"**.

- **Current predecessors** lists the linked tasks; each can be removed
  individually. (Predecessors that are already completed no longer appear here.)
- **Add predecessor:** choose a task, set a **weight
  (0.1–1)** in **expert mode** and click **"Add"**. Without expert mode, the selection is enough – the
  dependency is created with the default weight 1. The weight controls how strongly the
  predecessor contributes to the value of the dependent task (1 = full influence).

Balamentum prevents **circular dependencies** (e.g. A → B → A) and rejects them
with a clear message. This keeps the dependency graph always
consistent – and the "Next task" is always the most important one whose
predecessors are all completed.

---

## Categories

Categories organize your tasks by **topic** – "House build", "Taxes", "Club". Each
task and each series has at most one; it appears as a colored badge in the
lists and can be chosen as a filter in the search.

### Category or pillar?

Both organize, but with different effects – that's why there are both:

|                 | Life pillar                                | Category                          |
| --------------- | ------------------------------------------ | --------------------------------- |
| Question        | What does this contribute to in my life?   | Where does this belong topically? |
| Number per task | several, each with a share in percent      | exactly one or none               |
| Effect          | controls value, prioritization and balance | only grouping, badge, filter      |
| Example         | Body, Relationships, Meaning               | House build, Taxes, Club          |

In short: misusing a pillar as a folder ("House build" as a sixth pillar) distorts the
balance calculation. That's what categories are for.

### Creating and managing categories

Under _Settings → Categories_ you create categories, rename them, choose their
color from a fixed palette and delete them again. New accounts start without
categories – without a category, tasks simply stay unsorted.

When you delete one, the tasks and series are kept; they only lose the assignment.

### Assigning a category

In the task and series form you choose one under **"Category (optional)"**.
During quick capture, the AI suggests the matching category if the text
is unambiguous ("Order tiles for the house build project") – the suggestion can be changed before
saving. A series passes its category on to every generated task.

---

## Life balance pillars

Life balance pillars describe which areas of life a task contributes to. There are
**five fixed pillars**; they cannot be created, renamed or deleted. Each pillar
consists of a name and a short description.

### Distribution per task

In the task form, under **"Pillar distribution"**, you tap the pillars in order of their
importance – the most important first. The tapped pillars get the staircase shares
50/20/15/10/5 %, the untapped ones split the rest evenly; rank and share are shown as
text on each pillar. Tapping again removes the rank; tapping the most important pillar
is enough to save. Each pillar has a slider – it belongs to **expert mode** (Settings
→ General); by default, the ranking is all you use. The sliders share 100 %: if you drag
one up, the others give way.

No pillar drops below **5 %** as soon as it takes part in the distribution. Behind this is the
assumption that every task contributes a little to every area of life – to some
more strongly than to others. Older tasks that carry no or only individual pillars
keep their stored form; when **editing**, the distribution in the form is completed to
all pillars and saved that way the next time you save.

With **"Suggest pillars"** an AI suggests the shares based on title and description.
The suggestion appears as a separate **"AI suggestion"** block and is never applied
automatically – not even after quick capture with a pre-filled title. Only
**"Accept suggestion"** sets the distribution to the AI shares; **"Discard"** leaves your
previous ranking unchanged.

### Adjusting the pillar weighting

Under _Settings → Pillars_ you set which areas have priority right now – this
editor belongs to **expert mode**. Here, too, you
distribute 100 % across the five pillars: one slider pulls the others along, no pillar drops
below 5 %. With an even distribution, the weighting is neutral. If you increase e.g. "Body",
tasks that contribute strongly to "Body" rise in value – and thus move up in
prioritization.

---

## Pillar advisor

The **pillar advisor** is an AI guide for activities. It is part of
quick capture: open **"Create new task"** and click **"Get advice"**
in the free-text step.

- It suggests concrete activities and shows which pillars they contribute to –
  with a short explanation.
- It knows your current distribution from "My topics" and aligns its suggestions
  **preferably with the weakest (most under-served) pillars**.
- Optionally, describe your question or situation in the text field (e.g. "What can I do
  for myself this weekend?"). Without a question you get suggestions across all
  pillars. The field supports **voice input**.
- The suggestions appear below the text field; the dialog stays open. With **"Use as
  task"** you write a suggestion back into the same text field and go from there
  to the form with **"Process and continue"**.

---

## Series (recurring tasks)

With **series** you create recurring tasks as a template. From a series,
Balamentum regularly generates new task instances.

- **Create a new series:** via **"Create new task"**, turn on the **"Series or template"**
  switch. Instead of a deadline you then set a **start date** and a
  **rhythm**: **Daily**, **Weekly**, **Monthly**, **Weekdays** (Mon–Fri),
  **Weekend** (Sat+Sun) or a specific day of the week (**Mondays** to
  **Sundays**). With a weekday rhythm, the start date must fall on the matching
  day of the week – otherwise the app shows you a hint before saving.
  Priority, effort, description and pillars are taken over as a template for
  each instance.
- **Create automatically:** the switch is on when creating. If you turn it off,
  the series does not create tasks on its own and counts as a **template**; rhythm,
  start date and **Delete automatically** are then omitted (when you turn it back on, your
  values are there again). In the tab,
  such a series carries the **Template** badge.
- **Create task:** in the **Series & templates** tab, the **Create task** action (plus symbol) creates a
  single task from a series or template. The dialog is pre-filled with the series' title, priority, effort and
  description; the due date is optional. For a dormant series the action is missing.
- **Manage:** in the **Series & templates** tab you see all series with their rhythm. There
  you can **edit** or **delete** them. When deleting, you choose between
  **"Yes (series + all tasks)"** and **"No (series only, tasks remain
  independent)"**: with **Yes**, the open instances are deleted as well; with **No**,
  all tasks remain as independent tasks. Instances that are already completed
  are kept as independent tasks in both cases.

Tasks created from a series carry the **Series** badge in the task tree;
if you change an instance individually, **modified** is added. Tasks from a template carry
**Template** or **Template (modified)**.

If someone in a group created a series for you and the shared
membership ends – because someone leaves the group or the group is deleted –,
this series carries the **Dormant** badge. It then no longer creates new tasks;
you can still edit and delete it.

### Editing series – cascade to existing instances

When you edit a series template and change **cascadable fields**
(title, priority, effort, description, address, **coordinates**, automatic deletion, pillars, category), a confirmation
dialog appears before saving: **"Apply changes to all instances?"**

- **Yes** – the changed values are transferred to all open instances
  (including those you have adjusted individually); instances that are already completed
  remain untouched.
- **No (series only)** – only the template is updated; future instances
  get the new values, existing ones remain untouched.

Rhythm and start date are **never** cascaded.

---

## Task graph

The **Graph** tab shows how your tasks are connected.

- An **arrow** points down from the subtask to the task it enables.
- The **thicker the line**, the stronger the weight of the dependency. The number is shown on
  the line, so you don't have to guess the strength.
- Each **node** shows the title, **priority**, **value** and – if there are subtasks –
  the **progress**.
- A task that contributes to several parent tasks appears **once** and has
  several edges.

One connected dependency chain is shown at a time. If you have several, you page
through them with **"Back"** and **"Next"**; in between, you see which one of how many you are
looking at. Tasks without any dependency do not appear here – link two tasks in the
"Tasks" tab via **"Dependencies"**, and the first chain shows up here.

Below the graphic are the buttons **Fit view**, **Zoom in** and
**Zoom out**; on a phone you move the section with your finger.

Tapping a node opens a detail card below it with priority, value,
total effort, progress and all predecessors and successors with their weight. From there
you go directly to **Edit dependencies**. Everything else – creating, changing,
checking off – you do in the "Tasks" tab.

Below that, two sections can be expanded: a **legend** that explains the arrows and
line widths, and **Graph as list** – the same information in text form and the way
for keyboard and screen reader users.

---

## Completed tasks and points

The **Completed** view of the Tasks tab (toggle at the top) lists all
finished tasks. For each pillar, a column shows how many **points** the task
earned there. On a phone, the table only shows title and
action for lack of space. With **"Reopen"** you bring a task back to the open state.

### Points (gamification)

When you complete a task, you collect points:

- The points equal the task's **effort times priority**, distributed proportionally across its
  pillars – according to the share with which the task contributes to each pillar.
  If you complete a task only after its deadline, you get only
  half the points.
- Tasks without a pillar assignment feed into the **dashboard total credit**, distributed
  according to your pillar weighting — in the completed table they show 0 points per column.
  This way, completed work becomes visible even without an assigned pillar.

Your total score and the breakdown per pillar appear on the dashboard under
**"Total credit"**.

### Milestone badges

The **"Milestones"** dashboard card shows fixed levels for your streak and your
collected gamification points. Reached levels are highlighted, unreached ones
remain visible. The evaluation is retroactive: existing data above a threshold
counts on the first visit, without you having to complete anything new.

- **Streak** (against your best mark): 3, 7, 14, 30, 100 days.
- **Points** (sum of your gamification points from completed tasks): 50, 250, 1000,
  5000 points.

A milestone once reached is kept: **"Reopen"** on a completed
task lowers your point total, but no longer takes away a level you have already reached.

---

## Settings

The **gear** in the header opens the settings with the sections
General, Pillars, Categories, Location, Places, AI, Groups and **Plans & subscription**. App admins also see the **User management** section
(see below).

### General

- **Display name** – the name the dashboard greets you with; after changing it,
  apply it with **"Save display name"**.
- **Appearance** – choose the color scheme: **System**, **Light** or **Dark**.
  "System" follows your operating system's setting.
- **Header** – sets whether the header is at the **top** or **bottom** of the screen.
  In both positions it stays visible while scrolling. The choice applies
  to this device.
- **Language** – the language of the interface: German or English. The choice applies to
  the whole app, the help, push notifications and emails.
  The choice takes effect immediately and is saved on this device. Without a choice of your own,
  the app follows your browser's language setting; if that
  language is not available, the interface appears in German.
- **Calendar** – connect the ICS address of your calendar (for Google Calendar, the
  "secret address in iCal format"), optionally with a name, via **"Connect"**. The events of the
  next 14 days appear in the week view; the address stays secret and is never
  displayed. Calendars that are only reachable via CalDAV are connected with **"CalDAV"**, the
  calendar address, your user name and an app password; access is read-only, the
  password is stored encrypted and never displayed. Your plan determines how many calendars
  are possible (Free: one, Plus and Pro: five).
  **"Remove"** deletes the calendar with its events and credentials.
  With a connected calendar, **"Minimum length of free gaps"** (10–240 minutes, default 30)
  sets the length from which a gap appears in the "Free time" card.
- **Life balance image** – choose between **Heart**, **Bubbles**, **Discs**,
  **Rings**, **Rays**, **Blossom**, **Crystal**, **Segments** and **Hands**. All show the same calculation, just
  displayed differently. The choice is saved to your account and applies on all devices where you
  are signed in.
- **Animations** – the switches **"Animations"**, **"Animate heart"** and
  **"Animate completion"** control the movements of the balance image on the
  dashboard and the sequence when completing a task. Without motion, the
  image stays complete; it just stands still.
- **Expert mode** – when the switch is on, the app shows the advanced sliders: pillar percentages in the
  task dialog, weights in the dependency dialog, pillar weighting in the
  **"Pillars"** tab and range/interval in the **"Location"** tab. The choice is saved to your account
  and applies on all devices where you are signed in – as do **"Enable AI"**,
  **"Balance prioritization"** and **"Track location"**. Saved values are kept even without
  expert mode.
- **Auto-start voice recording** – when the switch is on, the microphone
  of the voice fields (task form, quick capture, search) starts as soon as you open them.
  When you turn it on, microphone access is requested.
- **Delete account** – in the **"Account"** card you delete your account permanently after a
  two-step confirmation, with all tasks, series, pillars, categories
  and settings; tasks and series you created for group members
  remain for them. Feedback you have sent is removed as well. As long as a subscription is running or you are the last admin of a group,
  the app refuses the deletion. A PayPal subscription with an open payment is cancelled by the app
  at the same time.
- **Enable push notifications** – see "Notifications".

### Pillars

The editor for the **pillar weighting** (see "Life balance pillars") and the
overview of your five fixed pillars with name, description and weight.

### Categories

Managing categories (create, edit, delete – each in its own
modal dialog) including the color choice from the fixed palette; see "Categories".

### AI

At the top, **"Enable AI"** turns the AI controls on and off as a whole.
If the switch is off, "Create new task" opens the full form directly, and the
copy-editing buttons disappear from the task form. The sections below are then
collapsed and can be expanded with a click; existing access tokens remain valid. Without
a suitable plan, all controls in the tab are locked, even with your own provider.

The AI is configured in the **AI providers** card (quick capture, pillar suggestion, pillar advisor,
copy editing). You choose the active provider and from it, via dropdown, the model – the
model list is loaded live from the provider. Built-in providers (Mistral, OpenRouter)
get their access from the server; you create your own providers via **"New provider"**
(name, address, API key, model) and can **test**, edit and delete them. Your own
providers belong to your account ("own"); the built-in ones are shared across the instance
("instance-wide"). Without a choice of your own, your AI calls run through the instance-wide active
provider. If no provider is set up, the
tab shows a hint that the AI features are not usable yet.

In the **Access tokens** card, under **"Create access token"**, you create personal
**tokens** with which AI clients such as Claude and other external programs access your data
– with your permissions. **"Generate token"** creates one and shows its
key **exactly once**; under **"Existing access tokens"** you then only see the
name, permission level, expiry and last use. For each token you switch between **Read
only** and **Read and write**. **"Revoke"** blocks a token from the
next call on.

In the **Dialog instructions for the AI** card you store a free text (up to 2000
characters, e.g. "Answer briefly and concisely."). AI clients that connect via access token
receive it when the connection is established. **"Save"** applies the text; an
empty field deletes the instructions. The tools and permissions of the tokens do not change as a result.

### Location

- **Track location** – regularly determines your current
  position in the background (by default every 5 minutes). When you turn it on, the
  location permission is requested. With **"Determine location"** you get the
  position immediately; you also see the time of the last capture and an
  address for the location. Three sliders control the location feature – they
  belong to **expert mode** (Settings → General):
  **Display distance** – up to this distance the "Nearby" list shows
  tasks; **Alert distance** – if a task is closer than this distance,
  a push notification arrives; **Update interval** – how often the position is
  determined.

### Places

Saved places have their own tab and are independent of the location switch. You save places you need often here once and then pick them directly in the address field.

- **Create:** under **"Saved places"**, type an address and choose it from the
  suggestion list – address and coordinates are taken over together –,
  then click **"Create"**.
- **My places:** the list below shows all saved places. You remove an entry
  after confirmation with **"Delete permanently"**.

In the address field of tasks and series, your saved places appear before the
search results. Because they are saved with coordinates, they count for
"Nearby".

---

## Plans

In the **Plans & subscription** section, the lower card compares the available plans in a table with prices and features; features that only come with a higher plan are listed further down. On narrow screens the table can be scrolled sideways. You can switch between plans – before confirming, the dialog shows, for an upgrade, the price of the new plan, the credited balance and the amount due; for a downgrade, until when the current plan runs and from when the lower price applies (due now: €0.00). The switch is processed on the server. A higher plan or a different billing period applies as soon as the payment has been received – until then it is marked as "active once payment is received"; a lower plan applies from the end of the current period. When switching to a higher plan or to a different period in the same plan via PayPal, you confirm a new subscription at PayPal; the paid remaining term of the old plan is credited to the day on the first period and shown as a separate item on the invoice.

Features above Free carry a badge with the plan name – such as groups,
AI support, weighted dependencies and location reminders; voice input and simple
dependencies belong to Free. AI assistance is subject to fair use: there is no counter and no block. If you make a very large number of requests in a month, you get a notice, and the AI help then responds somewhat more slowly.

**Transition rule for existing accounts:** an account that was created before plans were introduced
and has not booked a plan has **Pro** and thus all features.

---

## Subscription

In the upper card of the **Plans & subscription** section you see your current subscription status. If a PayPal subscription is running, the **Cancel contracts here** button is right there: in the next step you choose regular or extraordinary cancellation (with a reason) and the email address for the confirmation, then confirm with **Cancel now**. The plan continues until the end of the term; the cancellation confirmation with date and end of contract arrives by email as soon as PayPal has reported the cancellation. Invoices can be expanded below; even after a subscription has ended, old invoices remain visible there. Each invoice is available there as a PDF download and was also sent as an email attachment when the payment was received.

---

## Groups

In _Settings → Groups_ you organize tasks together with other users:

- **Create group:** set a name – this makes you the group's admin. Admins carry
  the **"Admin"** badge, members **"Member"**.
- **Manage members:** as an admin, you search for an account in the group via **"Search account"**
  and invite it with **"Invite"**; removing members is also
  only possible as an admin.
- **Invite by link:** in the group, under **"Create link"**, you create an
  invitation link. Whoever opens it – even without being signed in – lands on a page with
  **"Join group"**. Under **"Open invitations"** you can copy links or
  invalidate them (**"Invalidate"**).
- **Duo:** when creating, choose the **"Duo"** option under **"Type"** – two people
  who see a shared streak and their pillar scores, but none of each other's tasks.
  You bring in your partner via **"Create link"**; once the duo is full, inviting is no longer available.
- **Invitations** (card in the group overview, not to be confused with
  "Open invitations"): invited accounts can accept or decline.
- **Create tasks for others:** in the task and series form, you choose in the
  **"Recipient"** field who the task is for. In the lists you recognize
  other people's tasks by the hints **"For: {name}"** and **"Created by: {name}"**;
  they can only be edited by the recipient.
- **7-day challenge:** any member can start a week focused on balance in the group via
  **"Start 7-day challenge"**. The
  ranking measures the balance of the tasks completed in that week, not their number;
  anyone who has not completed anything yet is at the end with "No score yet". After seven days
  the challenge ends on its own, and **"Share"** creates a summary card with
  the group name, period and ranking – without task contents.

---

## User management (administrators only)

Every account has an app-wide role: **Admin**, **Member** or **Tester**. This role
is something different from the admin role within a group (see [Groups](#groups)) – someone
who manages a group is therefore not yet an admin of the app.

- **Who is admin:** accounts whose email address the operator has entered in `ADMIN_EMAILS`
  automatically become admin when signing in. All other accounts are
  members. Addresses removed from the list remain admin until someone downgrades the role in the
  app.
- **User management section:** admins see the additional
  _User management_ section in the settings with all accounts (name, email, role). Using the
  role toggles per account (Admin, Member, Tester) you change the role;
  the change takes effect immediately, even for people who are already signed in.
- **Block/cancel subscription:** with "Block subscription" you immediately stop a
  person's access to their paid plan. "Cancel subscription" cancels the subscription with the
  payment provider – the paid plan then continues until the end of the
  booked period. Both actions require a confirmation;
  Google Play subscriptions cannot be cancelled, but they can be blocked.
- **Delete subscriptions:** under "Subscriptions of …" you delete a single subscription or, via
  "Delete all subscriptions of this user", all subscriptions of a person – after a
  confirmation. The subscription is cancelled with the payment provider and removed completely together with its
  invoices; the person only keeps the plan of a still
  running subscription, otherwise Free. Payments are not refunded. Intended for
  cleaning up test purchases before going live.
- **Delete account:** for every other person there is "Delete account" – after two
  confirmation steps, as with deleting your own account: personal data and feedback
  are removed, invoices and subscription records remain. If a subscription is still running or
  the person is the last admin of a group with other members, the account
  remains and the dialog names the next step. You delete your own account in the
  settings.
- **At least one admin:** nobody can downgrade the last remaining admin
  – appoint another person first.
- **Members** do not see the section; opening `/settings/nutzer` directly takes
  them to the _Pillars_ section.

---

## Notifications (push)

Balamentum can remind you of due tasks via **push notification** – even
when the app is not open.

- Enable via _Settings → General → "Enable push notifications"_. When you
  turn it on, the browser asks for notification permission.
- With **"Test push"** you can trigger a test notification.
- If your browser does not support push notifications, a hint appears – installing
  the app usually helps (see below).
- The app sends reminders once a day as **one bundled notification each**:
  all open tasks whose deadline expires within the next 24 hours or
  has already passed ("Due tasks"). In addition, there is a **separate** notification
  "Your top tasks" with up to three tasks. A due date that has already been reported
  is not reported again.
- If location tracking is active, you additionally get a hint when an
  open task with a location is closer than your alert distance (default 1 km):
  as a single notification with title and distance, or as a bundled notification
  "X tasks nearby". Here, too, the same task is not reported again
  right away.

> **Note: avoiding duplicate notifications.** If you use Balamentum only as a
> browser tab (Chrome) and **not** as a standalone app, a **second notification** from Chrome can
> appear next to the app notification (e.g.
> "Copy URL", "Share", "Open in Chrome"). This duplicate notification is a
> platform behavior of Chrome, not of Balamentum. **Workaround:** install the
> app as a standalone app (see "Installing and updating the app" below) – then
> only the intended app notification is shown. Consecutive pushes
> also replace each other, so nothing piles up – the app gives its
> notifications a fixed tag for this.

---

## Installing and updating the app

Balamentum is an **installable web app (PWA)** and also works offline.

- **Install:** if the **"Install app"** banner appears, you can put the app on your device with
  **"Install"**. On iOS/Safari, use **Share →
  Add to Home Screen**.
- **Update:** when a new version is available, a card with
  **"Reload now"** appears at the bottom. A click loads the current version.

A **"Ready to work offline"** card confirms that the app can also be used without a connection.

The current version number is shown in the **footer**; if location tracking is
active, your most recently determined position is shown there as well.

---

## Keyboard shortcuts

- **Ctrl + Enter** (or **⌘ + Enter**) – triggers the primary action in dialogs
  (e.g. Create/Edit, "Process and continue", "Add" predecessor,
  "Save" in the settings, "Delete permanently"). "Get advice" remains
  click-only.
- **Esc** or a click outside – closes dialogs and menus.

---

## Further notes

- All data is stored **on the server**; changes are persisted immediately
  and available on all your devices.
- The AI features (quick capture, pillar suggestion, pillar advisor, copy editing, AI draft) require
  access configured on the server. If it is not set up, all
  other features remain fully usable.
