const state = {
  plan: null,
  filters: {
    query: "",
    week: "all",
    status: "all",
  },
  saveTimer: null,
};

const els = {
  title: document.querySelector("#planTitle"),
  saveState: document.querySelector("#saveState"),
  saveButton: document.querySelector("#saveButton"),
  complete: document.querySelector("#completeCount"),
  remaining: document.querySelector("#remainingCount"),
  percent: document.querySelector("#percentCount"),
  deadline: document.querySelector("#deadlineLabel"),
  search: document.querySelector("#searchInput"),
  weekFilter: document.querySelector("#weekFilter"),
  statusFilter: document.querySelector("#statusFilter"),
  progressBar: document.querySelector("#progressBar"),
  weeks: document.querySelector("#weeks"),
};

function allTasks(plan = state.plan) {
  return plan.weeks.flatMap((week) =>
    week.days.flatMap((day) => day.tasks.map((task) => ({ week, day, task }))),
  );
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function setSaveState(label, error = false) {
  els.saveState.textContent = label;
  els.saveState.classList.toggle("error", error);
}

function updateSummary() {
  const tasks = allTasks();
  const done = tasks.filter(({ task }) => task.completed).length;
  const total = tasks.length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  els.complete.textContent = done;
  els.remaining.textContent = total - done;
  els.percent.textContent = `${percent}%`;
  els.deadline.textContent = state.plan.targetDeadline ? formatDate(state.plan.targetDeadline) : "-";
  els.progressBar.style.width = `${percent}%`;
}

function taskVisible(task) {
  if (state.filters.status === "open" && task.completed) return false;
  if (state.filters.status === "done" && !task.completed) return false;
  if (!state.filters.query) return true;
  return task.title.toLowerCase().includes(state.filters.query);
}

function renderWeekFilter() {
  els.weekFilter.innerHTML = [
    '<option value="all">All weeks</option>',
    ...state.plan.weeks.map((week) => `<option value="${week.number}">Week ${week.number}</option>`),
  ].join("");
}

function render() {
  updateSummary();
  const selectedWeek = state.filters.week;
  const weeks = state.plan.weeks.filter(
    (week) => selectedWeek === "all" || String(week.number) === selectedWeek,
  );

  els.weeks.innerHTML = "";
  let renderedTasks = 0;

  for (const week of weeks) {
    const weekEl = document.createElement("article");
    weekEl.className = "week";

    const weekTasks = week.days.flatMap((day) => day.tasks);
    const weekDone = weekTasks.filter((task) => task.completed).length;
    weekEl.innerHTML = `
      <div class="week-header">
        <div>
          <h2>Week ${week.number}</h2>
          <p>${weekDone} of ${weekTasks.length} complete</p>
        </div>
        <button class="secondary" type="button" data-week="${week.number}">
          Toggle week
        </button>
      </div>
      <div class="days"></div>
    `;

    const daysEl = weekEl.querySelector(".days");
    for (const day of week.days) {
      const visibleTasks = day.tasks.filter(taskVisible);
      if (visibleTasks.length === 0) continue;
      renderedTasks += visibleTasks.length;

      const dayDone = day.tasks.filter((task) => task.completed).length;
      const dayEl = document.createElement("section");
      dayEl.className = "day";
      dayEl.innerHTML = `
        <div class="day-head">
          <div>
            <h3>${formatDate(day.date)}</h3>
            <small>${dayDone} of ${day.tasks.length} complete</small>
          </div>
          <button class="secondary" type="button" data-day="${day.date}">
            Toggle day
          </button>
        </div>
      `;

      for (const task of visibleTasks) {
        const taskEl = document.createElement("label");
        taskEl.className = `task${task.completed ? " done" : ""}`;
        taskEl.innerHTML = `
          <input type="checkbox" data-task="${task.id}" ${task.completed ? "checked" : ""} />
          <span>
            <span class="task-title">${task.title}</span>
            <textarea class="notes" data-notes="${task.id}" placeholder="Notes">${task.notes || ""}</textarea>
          </span>
        `;
        dayEl.appendChild(taskEl);
      }

      daysEl.appendChild(dayEl);
    }

    els.weeks.appendChild(weekEl);
  }

  if (renderedTasks === 0) {
    els.weeks.innerHTML = '<p class="empty">No checklist items match these filters.</p>';
  }
}

async function saveNow() {
  clearTimeout(state.saveTimer);
  setSaveState("Saving");

  const response = await fetch("/api/checklist", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state.plan),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Save failed");
  }

  state.plan = await response.json();
  setSaveState(`Saved ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
  render();
}

function queueSave() {
  setSaveState("Unsaved");
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => {
    saveNow().catch((error) => setSaveState(error.message, true));
  }, 500);
}

function setTasks(tasks, completed) {
  const completedAt = completed ? new Date().toISOString() : null;
  for (const task of tasks) {
    task.completed = completed;
    task.completedAt = completedAt;
  }
  render();
  queueSave();
}

function bindEvents() {
  els.search.addEventListener("input", () => {
    state.filters.query = els.search.value.trim().toLowerCase();
    render();
  });

  els.weekFilter.addEventListener("change", () => {
    state.filters.week = els.weekFilter.value;
    render();
  });

  els.statusFilter.addEventListener("change", () => {
    state.filters.status = els.statusFilter.value;
    render();
  });

  els.saveButton.addEventListener("click", () => {
    saveNow().catch((error) => setSaveState(error.message, true));
  });

  els.weeks.addEventListener("change", (event) => {
    const taskId = event.target.dataset.task;
    if (taskId) {
      const match = allTasks().find(({ task }) => task.id === taskId);
      if (!match) return;
      match.task.completed = event.target.checked;
      match.task.completedAt = event.target.checked ? new Date().toISOString() : null;
      render();
      queueSave();
    }
  });

  els.weeks.addEventListener("input", (event) => {
    const taskId = event.target.dataset.notes;
    if (taskId) {
      const match = allTasks().find(({ task }) => task.id === taskId);
      if (!match) return;
      match.task.notes = event.target.value;
      queueSave();
    }
  });

  els.weeks.addEventListener("click", (event) => {
    const weekNumber = event.target.dataset.week;
    const dayDate = event.target.dataset.day;
    if (weekNumber) {
      const week = state.plan.weeks.find((item) => String(item.number) === weekNumber);
      const tasks = week.days.flatMap((day) => day.tasks);
      setTasks(tasks, tasks.some((task) => !task.completed));
    }
    if (dayDate) {
      const day = state.plan.weeks.flatMap((week) => week.days).find((item) => item.date === dayDate);
      setTasks(day.tasks, day.tasks.some((task) => !task.completed));
    }
  });
}

async function init() {
  try {
    const response = await fetch("/api/checklist");
    if (!response.ok) throw new Error("Could not load checklist");
    state.plan = await response.json();
    els.title.textContent = state.plan.title || "CCNA Progress";
    renderWeekFilter();
    bindEvents();
    render();
    setSaveState("Ready");
  } catch (error) {
    setSaveState(error.message, true);
  }
}

init();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installation still works as a normal web shortcut if registration is blocked.
    });
  });
}
