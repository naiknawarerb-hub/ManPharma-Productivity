(function () {
  const S = window.ManPharmaStorage;
  const viewState = {
    search: "",
    priority: "all",
    section: "all",
    dateField: "due",
    dateFrom: "",
    dateTo: ""
  };

  function q(sel) { return document.querySelector(sel); }
  function qa(sel) { return Array.from(document.querySelectorAll(sel)); }

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

  function parseDueDate(dateStr) {
    if (!dateStr) return null;
    const due = String(dateStr).includes("T") ? new Date(dateStr) : new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(due.getTime())) return null;
    return due;
  }

  function isDueWithinDays(dateStr, days = 7) {
    const due = parseDueDate(dateStr);
    if (!due) return false;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const diff = Math.ceil((dueDay - today) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff <= days;
  }

  function isDueNowOrPast(dateStr) {
    const due = parseDueDate(dateStr);
    if (!due) return false;
    return Date.now() >= due.getTime();
  }

  function getNotificationDate(item) {
    const reminderAt = item && item.meta ? item.meta.reminderAt : "";
    return parseDueDate(reminderAt) || parseDueDate(item ? item.dueDate : "");
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
    const tags = Array.isArray(item.meta?.tags) ? item.meta.tags.join(" ") : "";
    const hay = [
      item.title,
      item.description,
      item.category,
      item.priority,
      tags,
      item.module,
      JSON.stringify(item.meta || {})
    ].join(" ").toLowerCase();
    return hay.includes(needle);
  }

  function inDateRange(raw, from, to) {
    if (!from && !to) return true;
    const d = raw ? new Date(raw) : null;
    if (!d || Number.isNaN(d.getTime())) return false;
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    if (from) {
      const fromD = new Date(`${from}T00:00:00`);
      if (!Number.isNaN(fromD.getTime()) && target < fromD.getTime()) return false;
    }
    if (to) {
      const toD = new Date(`${to}T23:59:59`);
      if (!Number.isNaN(toD.getTime()) && target > toD.getTime()) return false;
    }
    return true;
  }

  function applyGlobalFilters(items) {
    return items.filter((item) => {
      if (viewState.section !== "all") {
        if (viewState.section === "content" && !["post", "video"].includes(item.module)) return false;
        if (viewState.section !== "content" && item.module !== viewState.section) return false;
      }
      if (viewState.priority !== "all" && String(item.priority || "").toLowerCase() !== viewState.priority) return false;
      if (!matchesSearch(item, viewState.search)) return false;
      const dateSource = viewState.dateField === "created" ? item.createdAt : item.dueDate;
      if (!inDateRange(dateSource, viewState.dateFrom, viewState.dateTo)) return false;
      return true;
    });
  }

  function cardHtml(item, lines) {
    const normalizedLines = Array.isArray(lines) ? lines.filter(Boolean) : [];
    const summary = normalizedLines[0] || "";
    const details = normalizedLines.slice(1);

    const attachments = Array.isArray(item.meta?.attachments) ? item.meta.attachments : [];
    const attachmentHtml = attachments.length
      ? `<p class="meta-line">Attachments: ${attachments.length}</p>
        <div class="chips">${attachments
          .map((file) => `<button class="attach-btn" data-action="preview-attachment" data-file-id="${escapeHtml(file.id)}" type="button">${escapeHtml(file.name || "File")}</button>`)
          .join("")}</div>`
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
              ${attachmentHtml}
              ${item.completedAt ? `<p class="meta-line">Completed: ${formatDate(item.completedAt)}</p>` : ""}
            </div>
          </div>
          <div class="item-actions">
            <button class="edit-btn" data-action="edit" data-id="${item.id}" ${item.completed ? "disabled title=\"Uncheck to edit\"" : ""}>✏️</button>
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

    const activeHtml = active.length
      ? active.map((item) => cardHtml(item, lineBuilder(item))).join("")
      : `<p class="meta-line">${escapeHtml(viewState.search || viewState.priority !== "all" || viewState.section !== "all" || viewState.dateFrom || viewState.dateTo ? "No results found." : activeEmpty)}</p>`;

    const completedHtml = completed.length
      ? completed.map((item) => cardHtml(item, lineBuilder(item))).join("")
      : `<p class="meta-line">${escapeHtml(doneEmpty)}</p>`;

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

    wrap.innerHTML = meta.ideaCategories
      .map((c) => {
        const value = S.normalizeCategory(c);
        const active = value === selected ? "active" : "";
        const remove = `<button type="button" class="chip-remove" data-action="remove-category" data-value="${escapeHtml(value)}">✕</button>`;
        const label = value.charAt(0).toUpperCase() + value.slice(1);
        return `<div class="category-chip-wrap"><button type="button" class="chip ${active}" data-value="${escapeHtml(value)}">${escapeHtml(label)}</button>${remove}</div>`;
      })
      .join("");
  }

  function drawPieChart(canvasId, values, labels, colors) {
    const canvas = q(`#${canvasId}`);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const total = values.reduce((a, b) => a + b, 0);
    if (!total) {
      ctx.fillStyle = "#6b6f7b";
      ctx.font = "14px sans-serif";
      ctx.fillText("No data", 12, 24);
      return;
    }
    let start = -Math.PI / 2;
    values.forEach((value, idx) => {
      const angle = (value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(90, 90);
      ctx.arc(90, 90, 70, start, start + angle);
      ctx.closePath();
      ctx.fillStyle = colors[idx] || "#666";
      ctx.fill();
      start += angle;
    });
    ctx.font = "11px sans-serif";
    labels.forEach((label, idx) => {
      ctx.fillStyle = colors[idx] || "#666";
      ctx.fillRect(180, 16 + idx * 18, 10, 10);
      ctx.fillStyle = "#222";
      ctx.fillText(`${label}: ${values[idx]}`, 194, 25 + idx * 18);
    });
  }

  function drawBarChart(canvasId, points, color) {
    const canvas = q(`#${canvasId}`);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!points.length) {
      ctx.fillStyle = "#6b6f7b";
      ctx.font = "14px sans-serif";
      ctx.fillText("No data", 12, 24);
      return;
    }
    const max = Math.max(...points.map((p) => p.value), 1);
    const chartW = canvas.width - 24;
    const chartH = canvas.height - 30;
    const barW = chartW / points.length;
    points.forEach((point, idx) => {
      const h = (point.value / max) * (chartH - 20);
      const x = 12 + idx * barW + 2;
      const y = canvas.height - h - 18;
      ctx.fillStyle = color || "#6700ff";
      ctx.fillRect(x, y, Math.max(barW - 6, 6), h);
      ctx.fillStyle = "#3c3f49";
      ctx.font = "10px sans-serif";
      ctx.fillText(point.label, x, canvas.height - 5);
    });
  }

  function updateMetrics(items) {
    const tasks = items.filter((i) => i.module === "task");
    const posts = items.filter((i) => i.module === "post");
    const videos = items.filter((i) => i.module === "video");
    const notes = items.filter((i) => i.module === "note");
    const revenue = items.filter((i) => i.module === "revenue");

    const videosInProgress = videos.filter((v) => !v.completed && (v.meta?.status || "") === "in-progress").length;
    const upcomingPosts = posts.filter((p) => !p.completed && isDueWithinDays(p.dueDate, 7)).length;
    const pendingTasks = tasks.filter((t) => !t.completed).length;
    const monthIncome = revenue.reduce((sum, r) => sum + Number(r.meta?.amount || 0), 0);

    if (q("#videosInProgress")) q("#videosInProgress").textContent = String(videosInProgress);
    if (q("#upcomingPosts")) q("#upcomingPosts").textContent = String(upcomingPosts);
    if (q("#pendingTasks")) q("#pendingTasks").textContent = String(pendingTasks);
    if (q("#monthIncome")) q("#monthIncome").textContent = `₹${monthIncome}`;
    if (q("#totalVideosText")) q("#totalVideosText").textContent = `${videos.length} total videos`;
    if (q("#totalVideos")) q("#totalVideos").textContent = String(videos.length);
    if (q("#totalNotes")) q("#totalNotes").textContent = String(notes.length);

    if (q("#aTasks")) q("#aTasks").textContent = String(tasks.length);
    if (q("#aPosts")) q("#aPosts").textContent = String(posts.length);
    if (q("#aNotes")) q("#aNotes").textContent = String(notes.length);
    if (q("#aIdeas")) q("#aIdeas").textContent = String(items.filter((i) => i.module === "idea").length);
    if (q("#aVideos")) q("#aVideos").textContent = String(videos.length);

    const taskPriorities = {
      High: tasks.filter((t) => String(t.priority).toLowerCase() === "high").length,
      Medium: tasks.filter((t) => String(t.priority).toLowerCase() === "medium").length,
      Low: tasks.filter((t) => String(t.priority).toLowerCase() === "low").length
    };
    drawPieChart("taskPieChart", Object.values(taskPriorities), Object.keys(taskPriorities), ["#c74042", "#b57a24", "#348554"]);

    const last7 = Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - idx));
      const key = d.toISOString().slice(0, 10);
      const count = items.filter((item) => (item.createdAt || "").slice(0, 10) === key).length;
      return { label: key.slice(5), value: count };
    });
    drawBarChart("activityTrendChart", last7, "#6700ff");

    const revenueBySource = {};
    revenue.forEach((r) => {
      const source = String(r.meta?.source || "other");
      revenueBySource[source] = (revenueBySource[source] || 0) + Number(r.meta?.amount || 0);
    });
    drawPieChart(
      "revenueCategoryChart",
      Object.values(revenueBySource),
      Object.keys(revenueBySource),
      ["#1f9ed9", "#4caf50", "#ff9800", "#9c27b0", "#e91e63", "#607d8b"]
    );

    const monthly = {};
    revenue.forEach((r) => {
      const d = new Date(r.createdAt || Date.now());
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthly[key] = (monthly[key] || 0) + Number(r.meta?.amount || 0);
    });
    const monthPoints = Object.keys(monthly).sort().slice(-6).map((m) => ({ label: m.slice(5), value: monthly[m] }));
    drawBarChart("revenueMonthlyChart", monthPoints, "#2fbd55");
  }

  function renderNotifications(items) {
    const notifications = [];

    items.filter((i) => i.module === "task" && !i.completed).forEach((task) => {
      const notifyAt = getNotificationDate(task);
      if (notifyAt && Date.now() >= notifyAt.getTime()) {
        notifications.push(`Task due: ${task.title} (${formatDate((task.meta && task.meta.reminderAt) || task.dueDate)})`);
      }
    });

    items.filter((i) => i.module === "post" && !i.completed).forEach((post) => {
      const notifyAt = getNotificationDate(post);
      if (notifyAt && Date.now() >= notifyAt.getTime()) {
        notifications.push(`Post scheduled: ${post.title} (${formatDate((post.meta && post.meta.reminderAt) || post.dueDate)})`);
      }
    });

    const badge = q("#notifyCount");
    const list = q("#notificationList");
    if (!badge || !list) return;

    badge.textContent = String(notifications.length);
    badge.classList.toggle("hidden", notifications.length === 0);
    list.innerHTML = notifications.length
      ? notifications.map((n) => `<li>${escapeHtml(n)}</li>`).join("")
      : "<li>No due alerts right now.</li>";
  }

  function toCategoryLabel(value) {
    const text = String(value || "uncategorized").trim();
    if (!text) return "Uncategorized";
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function renderIdeasByCategory(ideas) {
    const el = q("#ideasList");
    if (!el) return;

    if (!ideas.length) {
      const emptyText = viewState.search || viewState.priority !== "all" || viewState.section !== "all" || viewState.dateFrom || viewState.dateTo
        ? "No results found."
        : "No active ideas.";
      el.innerHTML = `
        <section>
          <p class="meta-line"><strong>ACTIVE ITEMS</strong></p>
          <p class="meta-line">${emptyText}</p>
        </section>
        <section class="completed-wrap">
          <details class="completed-box">
            <summary>COMPLETED ITEMS (0)</summary>
            <div class="list"><p class="meta-line">No completed ideas.</p></div>
          </details>
        </section>
      `;
      return;
    }

    const grouped = new Map();
    ideas.forEach((idea) => {
      const key = S.normalizeCategory(idea.category || "uncategorized");
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(idea);
    });

    const categoryOrder = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b));
    el.innerHTML = categoryOrder
      .map((category) => {
        const items = grouped.get(category) || [];
        const active = items.filter((i) => !i.completed);
        const completed = items
          .filter((i) => i.completed)
          .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime());

        const activeHtml = active.length
          ? active.map((item) => cardHtml(item, [`Category: ${item.category || "-"}`, item.description ? `Description: ${item.description}` : ""].filter(Boolean))).join("")
          : `<p class="meta-line">No active ideas in this category.</p>`;

        const completedHtml = completed.length
          ? completed.map((item) => cardHtml(item, [`Category: ${item.category || "-"}`, item.description ? `Description: ${item.description}` : ""].filter(Boolean))).join("")
          : `<p class="meta-line">No completed ideas in this category.</p>`;

        return `
          <section>
            <p class="meta-line"><strong>${escapeHtml(toCategoryLabel(category))}</strong></p>
            ${activeHtml}
            <section class="completed-wrap">
              <details class="completed-box">
                <summary>COMPLETED ITEMS (${completed.length})</summary>
                <div class="list">${completedHtml}</div>
              </details>
            </section>
          </section>
        `;
      })
      .join("");
  }

  function render() {
    const allItems = S.loadItems();
    const items = applyGlobalFilters(allItems);
    updateMetrics(allItems);
    renderIdeaCategories();
    renderNotifications(allItems);

    renderModule(
      "tasksList",
      items.filter((i) => i.module === "task"),
      (item) => [
        `Category: ${item.category || "-"}`,
        `Due: ${formatDate(item.dueDate)}`,
        item.meta?.reminderAt ? `Notify: ${formatDate(item.meta.reminderAt)}` : "",
        item.description ? `Description: ${item.description}` : ""
      ].filter(Boolean),
      "No active tasks.",
      "No completed tasks."
    );

    renderIdeasByCategory(items.filter((i) => i.module === "idea"));

    renderModule(
      "notesList",
      items.filter((i) => i.module === "note"),
      (item) => [`Subject: ${item.category || "-"}`, item.description ? `Notes: ${item.description}` : "", `Progress: ${Number(item.meta?.progress || 0)}%`].filter(Boolean),
      "No active notes.",
      "No completed notes."
    );

    renderModule(
      "postsList",
      items.filter((i) => i.module === "post"),
      (item) => [
        `Type: ${item.category || "-"}`,
        `Status: ${item.meta?.status || "-"}`,
        `Platform: ${item.meta?.platform || "-"}`,
        `Date: ${formatDate(item.dueDate)}`,
        item.meta?.reminderAt ? `Notify: ${formatDate(item.meta.reminderAt)}` : ""
      ],
      "No active posts.",
      "No completed posts."
    );

    renderModule(
      "videosList",
      items.filter((i) => i.module === "video"),
      (item) => [`Status: ${item.meta?.status || "-"}`],
      "No active videos.",
      "No completed videos."
    );

    renderModule(
      "revenueList",
      items.filter((i) => i.module === "revenue"),
      (item) => [`Source: ${item.meta?.source || "-"}`, `Amount: ₹${Number(item.meta?.amount || 0)}`],
      "No active revenue entries.",
      "No completed revenue entries."
    );

    renderModule(
      "revenueModuleList",
      items.filter((i) => i.module === "revenue"),
      (item) => [
        `Source: ${item.meta?.source || "-"}`,
        `Amount: ₹${Number(item.meta?.amount || 0)}`,
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
    setViewState(next) {
      Object.assign(viewState, next || {});
    }
  };
})();
