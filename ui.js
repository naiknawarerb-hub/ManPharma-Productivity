(function () {
  const S = window.ManPharmaStorage;

  const MANAGED_MODULES = new Set(["task", "idea", "post", "video", "revenue"]);

  const viewState = {
    search: "",
    dashboardDate: "",
    globalStatus: "all",
    globalCategory: "all",
    globalDate: "all"
  };

  let controlsBound = false;

  function q(sel) { return document.querySelector(sel); }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function parseDate(raw) {
    if (!raw) return null;
    const str = String(raw);
    const d = str.includes("T") ? new Date(str) : new Date(`${str}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

  function dateKeyFromRaw(raw) {
    const value = String(raw || "").trim();
    if (!value) return "";
    // Keep exact local date from form values like YYYY-MM-DD or YYYY-MM-DDTHH:mm
    const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    return "";
  }

  function localDateKeyFromDate(d) {
    if (!d || Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function normalizeDateKey(raw) {
    const direct = dateKeyFromRaw(raw);
    if (direct) return direct;
    const d = parseDate(raw);
    return d ? localDateKeyFromDate(d) : "";
  }

  function getTodayKey() {
    return localDateKeyFromDate(new Date());
  }

  function formatDate(raw) {
    if (!raw) return "-";
    const d = parseDate(raw);
    if (!d) return "-";
    const hasTime = String(raw).includes("T");
    if (hasTime) {
      return d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    }
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function formatDateOnly(raw) {
    const d = parseDate(raw);
    if (!d) return "-";
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  function priorityClass(priority) {
    const p = String(priority || "medium").toLowerCase();
    if (p === "high") return "high";
    if (p === "low") return "low";
    return "medium";
  }

  function priorityBadge(priority) {
    const p = priorityClass(priority);
    return `<span class="priority-badge ${p}">${p.charAt(0).toUpperCase() + p.slice(1)}</span>`;
  }

  function isManagedItem(item) {
    return item && MANAGED_MODULES.has(String(item.module || ""));
  }

  function itemCategoryTokens(item) {
    const tokens = [];
    const category = String(item.category || "").trim();
    if (category) tokens.push(category.toLowerCase());
    const source = String(item.meta?.source || "").trim();
    if (source) tokens.push(source.toLowerCase());
    const platform = String(item.meta?.platform || "").trim();
    if (platform) tokens.push(platform.toLowerCase());
    return [...new Set(tokens)];
  }

  function matchesSearch(item, term) {
    if (!term) return true;
    const needle = term.toLowerCase();
    const haystack = [
      item.title,
      item.description,
      item.category,
      item.priority,
      item.module,
      item.meta?.source,
      item.meta?.platform,
      item.meta?.status,
      item.meta?.notes,
      item.meta?.tags,
      item.meta?.paymentStatus
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  }

  function withinDateFilter(item, filter) {
    if (filter === "all") return true;
    const key = normalizeDateKey(item.dueDate);
    if (!key) return false;

    const today = parseDate(getTodayKey());
    const date = parseDate(key);
    if (!today || !date) return false;

    if (filter === "today") return key === getTodayKey();

    if (filter === "future") return date.getTime() > today.getTime();

    if (filter === "week") {
      const end = new Date(today);
      end.setDate(end.getDate() + 6);
      return date.getTime() >= today.getTime() && date.getTime() <= end.getTime();
    }

    return true;
  }

  function withinStatusFilter(item, filter) {
    if (filter === "all") return true;
    if (filter === "completed") return !!item.completed;

    const dueKey = normalizeDateKey(item.dueDate);
    if (!dueKey) return false;

    if (filter === "today") return !item.completed && dueKey === getTodayKey();

    if (filter === "upcoming") {
      const due = parseDate(dueKey);
      const today = parseDate(getTodayKey());
      return !!due && !!today && !item.completed && due.getTime() > today.getTime();
    }

    return true;
  }

  function matchesGlobalCategory(item, selectedCategory) {
    if (selectedCategory === "all") return true;
    const normalized = String(selectedCategory || "").trim().toLowerCase();
    return itemCategoryTokens(item).includes(normalized);
  }

  function applyGlobalFilters(items) {
    return items
      .filter(isManagedItem)
      .filter((item) => matchesSearch(item, viewState.search))
      .filter((item) => matchesGlobalCategory(item, viewState.globalCategory))
      .filter((item) => withinStatusFilter(item, viewState.globalStatus))
      .filter((item) => withinDateFilter(item, viewState.globalDate));
  }

  function cardHtml(item, lines) {
    const normalizedLines = Array.isArray(lines) ? lines.filter(Boolean) : [];
    const summary = normalizedLines[0] || "";
    const details = normalizedLines.slice(1);
    const attachments = Array.isArray(item.meta?.attachments) ? item.meta.attachments : [];

    const rescheduleBtn = item.module === "task" && !item.completed
      ? `<button class="edit-btn" data-action="reschedule" data-id="${item.id}" title="Reschedule">⏱️</button>`
      : "";

    return `
      <article class="list-item ${item.completed ? "completed" : ""}">
        <div class="item-main">
          <input class="toggle-box" type="checkbox" data-action="toggle" data-id="${item.id}" ${item.completed ? "checked" : ""} />
          <div class="item-content">
            <div class="item-title-row">
              <span class="item-title">${escapeHtml(item.title || "Untitled")}</span>
              ${priorityBadge(item.priority)}
            </div>
            ${summary ? `<p class="item-subline">${escapeHtml(summary)}</p>` : ""}
            <div class="item-bottom">
              ${details.map((line) => `<p class="meta-line">${escapeHtml(line)}</p>`).join("")}
              ${attachments.length ? `<p class="meta-line">Attachments: ${attachments.length}</p>` : ""}
              ${attachments.length ? `<div class="chips">${attachments
                .map((file) => `
                  <span class="attach-pill">
                    <button class="attach-btn" data-action="preview-attachment" data-file-id="${escapeHtml(file.id)}" type="button">👁</button>
                    <button class="attach-btn" data-action="download-attachment" data-file-id="${escapeHtml(file.id)}" type="button">⬇</button>
                    <span class="attach-name">${escapeHtml(file.name || "File")}</span>
                  </span>
                `)
                .join("")}</div>` : ""}
              ${item.completedAt ? `<p class="meta-line">Completed: ${formatDate(item.completedAt)}</p>` : ""}
            </div>
          </div>
          <div class="item-actions">
            <button class="edit-btn" data-action="edit" data-id="${item.id}" ${item.completed ? "disabled title=\"Uncheck to edit\"" : ""}>✏️</button>
            ${rescheduleBtn}
            <button class="delete-btn" data-action="delete" data-id="${item.id}">🗑️</button>
          </div>
        </div>
      </article>
    `;
  }

  function sectionHtml(title, html) {
    return `
      <section class="module-block">
        <p class="meta-line"><strong>${title}</strong></p>
        ${html}
      </section>
    `;
  }

  function renderModule(containerId, items, lineBuilder, labels) {
    const el = q(`#${containerId}`);
    if (!el) return;

    const active = items.filter((i) => !i.completed);
    const unscheduled = active.filter((i) => !normalizeDateKey(i.dueDate));
    const scheduled = active
      .filter((i) => normalizeDateKey(i.dueDate))
      .sort((a, b) => {
        const aTs = parseDate(a.dueDate)?.getTime() || 0;
        const bTs = parseDate(b.dueDate)?.getTime() || 0;
        return aTs - bTs;
      });
    const completed = items
      .filter((i) => i.completed)
      .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime());

    const noResults = viewState.search ? "No results found." : labels.activeEmpty;

    const unscheduledHtml = unscheduled.length
      ? unscheduled.map((item) => cardHtml(item, lineBuilder(item))).join("")
      : `<p class="meta-line">${escapeHtml(noResults)}</p>`;

    const scheduledHtml = scheduled.length
      ? scheduled.map((item) => cardHtml(item, lineBuilder(item))).join("")
      : `<p class="meta-line">No scheduled items.</p>`;

    const completedHtml = completed.length
      ? completed.map((item) => cardHtml(item, lineBuilder(item))).join("")
      : `<p class="meta-line">${escapeHtml(labels.doneEmpty)}</p>`;

    el.innerHTML = `
      ${sectionHtml("UNSCHEDULED ITEMS", unscheduledHtml)}
      ${sectionHtml("SCHEDULED ITEMS", scheduledHtml)}
      <section class="completed-wrap">
        <details class="completed-box">
          <summary>COMPLETED ITEMS (${completed.length})</summary>
          <div class="list">${completedHtml}</div>
        </details>
      </section>
    `;
  }

  function renderIdeasByCategory(containerId, ideas) {
    const el = q(`#${containerId}`);
    if (!el) return;

    const activeIdeas = ideas.filter((i) => !i.completed);
    const completedIdeas = ideas.filter((i) => i.completed);

    const grouped = new Map();
    activeIdeas.forEach((idea) => {
      const key = String(idea.category || "general").trim() || "general";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(idea);
    });

    const groupHtml = Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([category, rows]) => {
        const cards = rows.map((item) => cardHtml(item, [
          `Category: ${item.category || "-"}`,
          item.description ? `Description: ${item.description}` : "",
          normalizeDateKey(item.dueDate) ? `Date: ${formatDate(item.dueDate)}` : "Unscheduled"
        ].filter(Boolean))).join("");
        return `
          <section class="idea-group">
            <h4 class="idea-group-title">${escapeHtml(category)}</h4>
            <div class="list">${cards}</div>
          </section>
        `;
      })
      .join("");

    const activeSection = activeIdeas.length
      ? groupHtml
      : `<p class="meta-line">${escapeHtml(viewState.search ? "No results found." : "No active ideas.")}</p>`;

    const completedHtml = completedIdeas.length
      ? completedIdeas.map((item) => cardHtml(item, [
        `Category: ${item.category || "-"}`,
        item.description ? `Description: ${item.description}` : "",
        normalizeDateKey(item.dueDate) ? `Date: ${formatDate(item.dueDate)}` : "Unscheduled"
      ].filter(Boolean))).join("")
      : `<p class="meta-line">No completed ideas.</p>`;

    el.innerHTML = `
      <section class="module-block">
        <p class="meta-line"><strong>IDEAS BY CATEGORY</strong></p>
        ${activeSection}
      </section>
      <section class="completed-wrap">
        <details class="completed-box">
          <summary>COMPLETED ITEMS (${completedIdeas.length})</summary>
          <div class="list">${completedHtml}</div>
        </details>
      </section>
    `;
  }

  function renderIdeaCategories() {
    const wrap = q("#ideaCategoryChips");
    if (!wrap) return;
    const meta = S.loadMeta();
    const selected = (q('[data-chip-group="ideaCategory"] .chip.active') || {}).dataset?.value || meta.ideaCategories?.[0] || "pharmacology";
    wrap.innerHTML = (meta.ideaCategories || [])
      .map((c) => {
        const value = S.normalizeCategory(c);
        const active = value === selected ? "active" : "";
        const remove = `<button type="button" class="chip-remove" data-action="remove-category" data-value="${escapeHtml(value)}">✕</button>`;
        const label = value.charAt(0).toUpperCase() + value.slice(1);
        return `<div class="category-chip-wrap"><button type="button" class="chip ${active}" data-value="${escapeHtml(value)}">${escapeHtml(label)}</button>${remove}</div>`;
      })
      .join("");
  }

  function renderTaskCategories() {
    const formWrap = q("#taskFormCategoryChips");
    if (!formWrap) return;
    const meta = S.loadMeta();
    const selected = (q('[data-chip-group="taskCategory"] .chip.active') || {}).dataset?.value || (meta.taskCategories || [])[0] || "general";

    formWrap.innerHTML = (meta.taskCategories || [])
      .map((c) => {
        const value = S.normalizeCategory(c);
        const active = value === selected ? "active" : "";
        const label = value.charAt(0).toUpperCase() + value.slice(1);
        return `
          <div class="category-chip-wrap">
            <button type="button" class="chip ${active}" data-value="${escapeHtml(value)}">${escapeHtml(label)}</button>
            <button type="button" class="chip-remove" data-action="delete-task-category" data-value="${escapeHtml(value)}">✕</button>
          </div>
        `;
      })
      .join("");
  }

  function daySectionHtml(items, emptyText) {
    const sections = [
      { key: "task", label: "Tasks" },
      { key: "idea", label: "Ideas" },
      { key: "content", label: "Content" },
      { key: "revenue", label: "Revenue" }
    ];

    return sections.map((section) => {
      const rows = section.key === "content"
        ? items.filter((i) => i.module === "post" || i.module === "video")
        : items.filter((i) => i.module === section.key);

      if (!rows.length) {
        return `
          <div class="scheduled-cell">
            <p class="meta-line section-title"><strong>${section.label}</strong></p>
            <p class="meta-line">${emptyText}</p>
          </div>
        `;
      }

      return `
        <div class="scheduled-cell">
          <p class="meta-line section-title"><strong>${section.label}</strong></p>
          <div class="week-item-list">
            ${rows.map((r) => {
              const due = parseDate(r.dueDate);
              const timeText = due && String(r.dueDate || "").includes("T")
                ? due.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                : "";
              const tintClass = r.module === "task"
                ? "tint-task"
                : r.module === "revenue"
                  ? "tint-revenue"
                  : (r.module === "post" || r.module === "video")
                    ? "tint-content"
                    : "tint-idea";

              return `
                <article class="week-item-card ${tintClass} ${r.completed ? "completed" : ""}">
                  ${r.module === "task" ? `<input class="toggle-box" type="checkbox" data-action="toggle" data-id="${r.id}" ${r.completed ? "checked" : ""} />` : ""}
                  <div class="week-item-content">
                    <p class="week-item-title">${escapeHtml(r.title || "Untitled")}</p>
                    <p class="week-item-meta">${escapeHtml(r.category || r.module || "-")}${timeText ? ` | ${escapeHtml(timeText)}` : ""}</p>
                  </div>
                </article>
              `;
            }).join("")}
          </div>
        </div>
      `;
    }).join("");
  }

  function renderDashboardDateViews(items) {
    const selected = viewState.dashboardDate || getTodayKey();

    const scheduledItems = items.filter((i) => normalizeDateKey(i.dueDate));
    const dayItems = scheduledItems.filter((i) => normalizeDateKey(i.dueDate) === selected);

    const dayList = q("#dashboardDayList");
    if (dayList) {
      const activeRows = dayItems.filter((i) => !i.completed);
      const doneRows = dayItems.filter((i) => i.completed);

      const renderRow = (item) => {
        const due = parseDate(item.dueDate);
        const timeText = due && String(item.dueDate || "").includes("T")
          ? due.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
          : "";

        return `
          <article class="day-task-row ${item.completed ? "completed" : ""}">
            <input class="toggle-box" type="checkbox" data-action="toggle" data-id="${item.id}" ${item.completed ? "checked" : ""} />
            <div class="day-task-content">
              <p class="day-task-title">${escapeHtml(item.title || "Untitled")}</p>
              <p class="day-task-meta">${escapeHtml(item.category || item.module || "-")}${timeText ? ` | ${escapeHtml(timeText)}` : ""}</p>
            </div>
          </article>
        `;
      };

      const activeHtml = activeRows.length
        ? activeRows.map(renderRow).join("")
        : `<p class="meta-line">${viewState.search ? "No results found." : "No active items for selected date."}</p>`;

      const doneHtml = doneRows.length
        ? doneRows.map(renderRow).join("")
        : `<p class="meta-line">No completed items.</p>`;

      dayList.innerHTML = `
        <section>
          <p class="meta-line"><strong>ACTIVE ITEMS</strong></p>
          <div class="day-task-list">${activeHtml}</div>
        </section>
        <section class="completed-wrap">
          <details class="completed-box">
            <summary>COMPLETED ITEMS (${doneRows.length})</summary>
            <div class="day-task-list">${doneHtml}</div>
          </details>
        </section>
      `;
    }

    const weekList = q("#dashboardWeekList");
    if (!weekList) return;

    const startDate = parseDate(`${selected}T00:00:00`) || parseDate(getTodayKey());
    if (!startDate) return;

    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      return localDateKeyFromDate(d);
    });

    weekList.innerHTML = days.map((dateKey) => {
      const day = parseDate(dateKey);
      const isWeekend = !!day && (day.getDay() === 0 || day.getDay() === 6);
      const list = scheduledItems.filter((i) => normalizeDateKey(i.dueDate) === dateKey);

      return `
        <details class="scheduled-group week-card ${isWeekend ? "weekend" : ""}" open>
          <summary class="scheduled-head">
            <div class="week-headline">
              <span class="week-arrow" aria-hidden="true"></span>
              <strong>${escapeHtml(formatDateOnly(dateKey))}</strong>
              ${isWeekend ? '<span class="weekend-chip">Weekend</span>' : ""}
            </div>
          </summary>
          <div class="scheduled-grid">${daySectionHtml(list, "No items")}</div>
        </details>
      `;
    }).join("");
  }

  function drawRevenuePieChart(revenueItems) {
    const canvas = q("#revenuePieChart");
    if (!canvas) return;

    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const width = Math.max(300, canvas.clientWidth || 320);
    const height = 220;

    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const totals = {};
    let total = 0;

    revenueItems.forEach((item) => {
      const source = String(item.meta?.source || "Other");
      const amount = Number(item.meta?.amount || 0);
      totals[source] = (totals[source] || 0) + amount;
      total += amount;
    });

    const entries = Object.entries(totals);
    if (!entries.length || total <= 0) {
      ctx.fillStyle = "#4f5460";
      ctx.font = "600 14px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
      ctx.fillText("No revenue data", 12, 24);
      return;
    }

    const colors = ["#1f9ed9", "#4caf50", "#ff9800", "#9c27b0", "#e91e63", "#607d8b"];
    const cx = 90;
    const cy = 110;
    const radius = 72;
    let start = -Math.PI / 2;

    entries.forEach(([_, amount], idx) => {
      const angle = (amount / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, start, start + angle);
      ctx.closePath();
      ctx.fillStyle = colors[idx % colors.length];
      ctx.fill();
      start += angle;
    });

    ctx.font = "700 12px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    ctx.fillStyle = "#1f2430";
    ctx.fillText(`Total: ₹${total}`, 12, 205);

    ctx.font = "600 11px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    entries.forEach(([label, amount], idx) => {
      const y = 24 + idx * 18;
      ctx.fillStyle = colors[idx % colors.length];
      ctx.fillRect(178, y - 8, 10, 10);
      ctx.fillStyle = "#2c3240";
      ctx.fillText(`${label}: ₹${amount}`, 194, y);
    });
  }

  function daysFromRange(range) {
    if (range === "1d") return 1;
    if (range === "3m") return 90;
    if (range === "6m") return 180;
    return 7;
  }

  function inRange(dateRaw, range) {
    const d = parseDate(dateRaw);
    if (!d) return false;
    const now = new Date();
    const from = new Date(now.getTime() - daysFromRange(range) * 24 * 60 * 60 * 1000);
    return d.getTime() >= from.getTime() && d.getTime() <= now.getTime();
  }

  function updateAnalytics(items) {
    const prodRange = String(q('[data-range-group="prodRange"] .range-btn.active')?.dataset.range || "7d");
    const revRange = String(q('[data-range-group="revRange"] .range-btn.active')?.dataset.range || "7d");

    const taskItems = items.filter((i) => i.module === "task" && inRange(i.createdAt || i.dueDate, prodRange));
    const taskScheduled = taskItems.length;
    const taskCompleted = taskItems.filter((i) => i.completed && inRange(i.completedAt || i.createdAt, prodRange)).length;
    const taskPending = taskItems.filter((i) => !i.completed).length;
    const taskRescheduled = taskItems.filter((i) => Number(i.rescheduleCount || 0) > 0).length;

    if (q("#prodScheduledMetric")) q("#prodScheduledMetric").textContent = String(taskScheduled);
    if (q("#prodCompletedMetric")) q("#prodCompletedMetric").textContent = String(taskCompleted);
    if (q("#prodPendingMetric")) q("#prodPendingMetric").textContent = String(taskPending);
    if (q("#prodRescheduledMetric")) q("#prodRescheduledMetric").textContent = String(taskRescheduled);

    const revenueItems = items.filter((i) => i.module === "revenue" && inRange(i.createdAt || i.dueDate, revRange));
    const revAdded = revenueItems.reduce((sum, r) => sum + Number(r.meta?.amount || 0), 0);
    const revReceived = revenueItems
      .filter((r) => String(r.meta?.paymentStatus || "received").toLowerCase() === "received")
      .reduce((sum, r) => sum + Number(r.meta?.amount || 0), 0);
    const revPending = revenueItems
      .filter((r) => String(r.meta?.paymentStatus || "received").toLowerCase() === "pending")
      .reduce((sum, r) => sum + Number(r.meta?.amount || 0), 0);

    const month = new Date();
    const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
    const monthlyTotal = items
      .filter((i) => i.module === "revenue")
      .filter((i) => String(i.createdAt || i.dueDate || "").slice(0, 7) === monthKey)
      .reduce((sum, r) => sum + Number(r.meta?.amount || 0), 0);

    if (q("#revAddedMetric")) q("#revAddedMetric").textContent = `₹${revAdded}`;
    if (q("#revReceivedMetric")) q("#revReceivedMetric").textContent = `₹${revReceived}`;
    if (q("#revPendingMetric")) q("#revPendingMetric").textContent = `₹${revPending}`;
    if (q("#revMonthlyMetric")) q("#revMonthlyMetric").textContent = `₹${monthlyTotal}`;

    drawRevenuePieChart(items.filter((i) => i.module === "revenue"));
  }

  function buildGlobalCategoryOptions(items) {
    const values = new Set(["content", "research", "admin"]);

    items.forEach((item) => {
      itemCategoryTokens(item).forEach((token) => {
        if (token) values.add(token);
      });
    });

    const taskMeta = S.loadMeta()?.taskCategories || [];
    const ideaMeta = S.loadMeta()?.ideaCategories || [];
    taskMeta.forEach((v) => values.add(String(v || "").toLowerCase()));
    ideaMeta.forEach((v) => values.add(String(v || "").toLowerCase()));

    return Array.from(values).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }

  function renderGlobalFilterOptions(items) {
    const categorySelect = q("#globalCategoryFilter");
    if (!categorySelect) return;

    const current = viewState.globalCategory || "all";
    const options = buildGlobalCategoryOptions(items);

    categorySelect.innerHTML = [
      `<option value="all">All Categories</option>`,
      ...options.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c.charAt(0).toUpperCase() + c.slice(1))}</option>`)
    ].join("");

    const nextValue = options.includes(current) || current === "all" ? current : "all";
    categorySelect.value = nextValue;
    if (viewState.globalCategory !== nextValue) {
      viewState.globalCategory = nextValue;
    }
  }

  function bindUiControls() {
    if (controlsBound) return;
    controlsBound = true;

    document.addEventListener("click", (e) => {
      const navBtn = e.target.closest(".nav-btn");
      if (navBtn && navBtn.dataset.view && window.matchMedia("(max-width: 56rem)").matches) {
        document.body.classList.remove("sidebar-mobile-open");
      }

      const statusBtn = e.target.closest('[data-global-filter="status"]');
      if (statusBtn) {
        const next = String(statusBtn.dataset.value || "all");
        viewState.globalStatus = next;
        document.querySelectorAll('[data-global-filter="status"]').forEach((btn) => {
          btn.classList.toggle("active", btn === statusBtn);
        });
        render();
      }

      if (e.target.closest("#menuToggleBtn")) {
        if (window.matchMedia("(max-width: 56rem)").matches) {
          document.body.classList.toggle("sidebar-mobile-open");
        } else {
          document.body.classList.toggle("sidebar-collapsed");
        }
      }

      if (e.target.closest("#sidebarCloseBtn") || e.target.closest("#sidebarBackdrop")) {
        document.body.classList.remove("sidebar-mobile-open");
      }

      const downloadBtn = e.target.closest("[data-action='download-attachment']");
      if (downloadBtn) {
        const fileId = String(downloadBtn.dataset.fileId || "");
        if (!fileId) return;
        S.loadAttachment(fileId).then((file) => {
          if (!file || !file.payload) return;
          const a = document.createElement("a");
          a.href = file.payload;
          a.download = file.name || "attachment";
          document.body.appendChild(a);
          a.click();
          a.remove();
        });
      }
    });

    q("#globalCategoryFilter")?.addEventListener("change", (e) => {
      viewState.globalCategory = String(e.target.value || "all").toLowerCase();
      render();
    });

    q("#globalDateFilter")?.addEventListener("change", (e) => {
      viewState.globalDate = String(e.target.value || "all");
      render();
    });
  }

  function render() {
    bindUiControls();

    const all = S.loadItems();
    const filtered = applyGlobalFilters(all);

    renderIdeaCategories();
    renderTaskCategories();
    renderGlobalFilterOptions(all.filter(isManagedItem));
    renderDashboardDateViews(filtered);
    updateAnalytics(all);

    renderModule(
      "tasksList",
      filtered.filter((i) => i.module === "task"),
      (item) => [
        `Category: ${item.category || "-"}`,
        normalizeDateKey(item.dueDate) ? `Due: ${formatDate(item.dueDate)}` : "Unscheduled",
        item.description ? `Description: ${item.description}` : ""
      ].filter(Boolean),
      { activeEmpty: "No active tasks.", doneEmpty: "No completed tasks." }
    );

    renderIdeasByCategory(
      "ideasList",
      filtered.filter((i) => i.module === "idea")
    );

    renderModule(
      "postsList",
      filtered.filter((i) => i.module === "post"),
      (item) => [
        `Type: ${item.category || "-"}`,
        `Status: ${item.meta?.status || "-"}`,
        `Platform: ${item.meta?.platform || "-"}`,
        normalizeDateKey(item.dueDate) ? `Date: ${formatDate(item.dueDate)}` : "Unscheduled"
      ],
      { activeEmpty: "No active posts.", doneEmpty: "No completed posts." }
    );

    renderModule(
      "videosList",
      filtered.filter((i) => i.module === "video"),
      (item) => [
        `Status: ${item.meta?.status || "-"}`,
        item.description ? `Description: ${item.description}` : "",
        "Unscheduled"
      ].filter(Boolean),
      { activeEmpty: "No active videos.", doneEmpty: "No completed videos." }
    );

    renderModule(
      "revenueModuleList",
      filtered.filter((i) => i.module === "revenue"),
      (item) => [
        `Source: ${item.meta?.source || "-"}`,
        `Amount: ₹${Number(item.meta?.amount || 0)}`,
        normalizeDateKey(item.dueDate) ? `Date: ${formatDate(item.dueDate)}` : "Unscheduled",
        `Payment: ${item.meta?.paymentStatus || "received"}`,
        item.description ? `Notes: ${item.description}` : ""
      ].filter(Boolean),
      { activeEmpty: "No active revenue entries.", doneEmpty: "No completed revenue entries." }
    );
  }

  window.ManPharmaUI = {
    render,
    renderIdeaCategories,
    formatDate,
    setSearchTerm(term) {
      viewState.search = String(term || "").trim();
    },
    setDashboardDate(value) {
      viewState.dashboardDate = String(value || "");
    },
    getDueAndOverdueTasks() {
      const now = Date.now();
      return S.loadItems()
        .filter((i) => i.module === "task" && !i.completed)
        .filter((i) => {
          const due = parseDate(i.dueDate);
          return due && due.getTime() <= now;
        })
        .sort((a, b) => new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime());
    }
  };
})();
