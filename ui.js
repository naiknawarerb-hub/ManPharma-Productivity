(function () {
  const S = window.ManPharmaStorage;
  const viewState = { search: "", dashboardDate: "" };

  function q(sel) { return document.querySelector(sel); }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function formatDate(raw) {
    if (!raw) return "-";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "-";
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

  function parseDate(raw) {
    if (!raw) return null;
    const d = String(raw).includes("T") ? new Date(raw) : new Date(`${raw}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

  function normalizeDateKey(raw) {
    const d = parseDate(raw);
    if (!d) return "";
    return d.toISOString().slice(0, 10);
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

  function matchesSearch(item, term) {
    if (!term) return true;
    const needle = term.toLowerCase();
    const allowed = ["task", "idea", "post", "video", "revenue"];
    if (!allowed.includes(item.module)) return false;
    const hay = [
      item.module,
      item.title,
      item.description,
      item.category,
      item.priority,
      JSON.stringify(item.meta || {})
    ].join(" ").toLowerCase();
    return hay.includes(needle);
  }

  function applySearch(items) {
    return items.filter((item) => matchesSearch(item, viewState.search));
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
                .map((file) => `<button class="attach-btn" data-action="preview-attachment" data-file-id="${escapeHtml(file.id)}" type="button">${escapeHtml(file.name || "File")}</button>`)
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

  function renderModule(containerId, items, lineBuilder, activeEmpty, doneEmpty) {
    const el = q(`#${containerId}`);
    if (!el) return;

    const active = items.filter((i) => !i.completed);
    const completed = items
      .filter((i) => i.completed)
      .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime());

    const emptyText = viewState.search ? "No results found." : activeEmpty;
    const activeHtml = active.length ? active.map((item) => cardHtml(item, lineBuilder(item))).join("") : `<p class="meta-line">${escapeHtml(emptyText)}</p>`;
    const completedHtml = completed.length ? completed.map((item) => cardHtml(item, lineBuilder(item))).join("") : `<p class="meta-line">${escapeHtml(doneEmpty)}</p>`;

    el.innerHTML = `
      <section>
        <p class="meta-line"><strong>ACTIVE ITEMS</strong></p>
        ${activeHtml}
      </section>
      <section class="completed-wrap">
        <details class="completed-box">
          <summary>COMPLETED ITEMS (${completed.length})</summary>
          <div class="list">${completedHtml}</div>
        </details>
      </section>
    `;
  }

  function renderIdeaCategories() {
    const wrap = q("#ideaCategoryChips");
    if (!wrap) return;
    const meta = S.loadMeta();
    const selected = (q('[data-chip-group="ideaCategory"] .chip.active') || {}).dataset?.value || meta.ideaCategories[0];
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
    const list = (meta.taskCategories || []).map((c) => {
      const value = S.normalizeCategory(c);
      const active = value === selected ? "active" : "";
      return { value, active, label: value.charAt(0).toUpperCase() + value.slice(1) };
    });

    formWrap.innerHTML = list
      .map((x) => `
        <div class="category-chip-wrap">
          <button type="button" class="chip ${x.active}" data-value="${escapeHtml(x.value)}">${escapeHtml(x.label)}</button>
          <button type="button" class="chip-remove" data-action="delete-task-category" data-value="${escapeHtml(x.value)}">✕</button>
        </div>
      `)
      .join("");
  }

  function daySectionHtml(items, emptyText, dateKey) {
    const sections = [
      { key: "task", label: "Tasks" },
      { key: "idea", label: "Ideas" },
      { key: "content", label: "Content" },
      { key: "revenue", label: "Revenue" }
    ];
    return sections
      .map((section) => {
        const rows = section.key === "content"
          ? items.filter((i) => i.module === "post" || i.module === "video")
          : items.filter((i) => i.module === section.key);
        const kind = section.key === "content" ? "post" : section.key;
        if (!rows.length) {
          return `
            <div class="scheduled-cell">
              <div class="section-head-row">
                <p class="meta-line section-title"><strong>${section.label}</strong></p>
                <button type="button" class="section-add-btn" data-action="add-for-date" data-kind="${kind}" data-date="${dateKey}" aria-label="Add ${section.label}">+</button>
              </div>
              <p class="meta-line">${emptyText}</p>
            </div>
          `;
        }
        return `
          <div class="scheduled-cell">
            <div class="section-head-row">
              <p class="meta-line section-title"><strong>${section.label}</strong></p>
              <button type="button" class="section-add-btn" data-action="add-for-date" data-kind="${kind}" data-date="${dateKey}" aria-label="Add ${section.label}">+</button>
            </div>
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
      })
      .join("");
  }

  function renderDashboardDateViews(items) {
    const selected = viewState.dashboardDate || new Date().toISOString().slice(0, 10);
    const dayItems = items.filter((i) => normalizeDateKey(i.dueDate || i.createdAt) === selected);
    const dayList = q("#dashboardDayList");
    if (dayList) {
      const activeRows = dayItems.filter((i) => !i.completed);
      const doneRows = dayItems.filter((i) => i.completed);
      const renderRow = (item) => {
        const due = parseDate(item.dueDate);
        const timeText = due && String(item.dueDate || "").includes("T")
          ? due.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
          : "";
        const category = item.category || item.module || "-";
        return `
          <article class="day-task-row ${item.completed ? "completed" : ""}">
            <input class="toggle-box" type="checkbox" data-action="toggle" data-id="${item.id}" ${item.completed ? "checked" : ""} />
            <div class="day-task-content">
              <p class="day-task-title">${escapeHtml(item.title || "Untitled")}</p>
              <p class="day-task-meta">${escapeHtml(category)}${timeText ? ` | ${escapeHtml(timeText)}` : ""}</p>
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
    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(`${selected}T00:00:00`);
      d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    });

    weekList.innerHTML = days
      .map((dateKey) => {
        const day = new Date(`${dateKey}T00:00:00`);
        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
        const list = items.filter((i) => normalizeDateKey(i.dueDate || i.createdAt) === dateKey);
        return `
          <details class="scheduled-group week-card ${isWeekend ? "weekend" : ""}" open>
            <summary class="scheduled-head">
              <div class="week-headline">
                <span class="week-arrow" aria-hidden="true"></span>
                <strong>${escapeHtml(formatDateOnly(dateKey))}</strong>
                ${isWeekend ? '<span class="weekend-chip">Weekend</span>' : ""}
              </div>
            </summary>
            <div class="scheduled-grid">${daySectionHtml(list, "No items", dateKey)}</div>
          </details>
        `;
      })
      .join("");
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

    const monthKey = new Date().toISOString().slice(0, 7);
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

  function render() {
    const all = S.loadItems();
    const filtered = applySearch(all);

    renderIdeaCategories();
    renderTaskCategories();
    renderDashboardDateViews(filtered);
    updateAnalytics(all);

    renderModule(
      "tasksList",
      filtered.filter((i) => i.module === "task"),
      (item) => [`Category: ${item.category || "-"}`, `Due: ${formatDate(item.dueDate)}`, item.description ? `Description: ${item.description}` : ""].filter(Boolean),
      "No active tasks.",
      "No completed tasks."
    );

    renderModule(
      "ideasList",
      filtered.filter((i) => i.module === "idea"),
      (item) => [`Category: ${item.category || "-"}`, item.description ? `Description: ${item.description}` : "", `Date: ${formatDate(item.dueDate)}`].filter(Boolean),
      "No active ideas.",
      "No completed ideas."
    );

    renderModule(
      "postsList",
      filtered.filter((i) => i.module === "post"),
      (item) => [`Type: ${item.category || "-"}`, `Status: ${item.meta?.status || "-"}`, `Platform: ${item.meta?.platform || "-"}`, `Date: ${formatDate(item.dueDate)}`],
      "No active posts.",
      "No completed posts."
    );

    renderModule(
      "videosList",
      filtered.filter((i) => i.module === "video"),
      (item) => [`Status: ${item.meta?.status || "-"}`],
      "No active videos.",
      "No completed videos."
    );

    renderModule(
      "revenueModuleList",
      filtered.filter((i) => i.module === "revenue"),
      (item) => [
        `Source: ${item.meta?.source || "-"}`,
        `Amount: ₹${Number(item.meta?.amount || 0)}`,
        `Date: ${formatDate(item.dueDate)}`,
        `Payment: ${item.meta?.paymentStatus || "received"}`,
        item.description ? `Notes: ${item.description}` : ""
      ],
      "No active revenue entries.",
      "No completed revenue entries."
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
