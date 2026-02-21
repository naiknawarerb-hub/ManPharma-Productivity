(function () {
  const S = window.ManPharmaStorage;

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
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function isDueSoon(dateStr, days = 2) {
    if (!dateStr) return false;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const due = new Date(dateStr + "T00:00:00");
    const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    return diff <= days;
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

  function cardHtml(item, lines) {
    const normalizedLines = Array.isArray(lines) ? lines.filter(Boolean) : [];
    const summary = normalizedLines[0] || "";
    const details = normalizedLines.slice(1);

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
      : `<p class="meta-line">${escapeHtml(activeEmpty)}</p>`;

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
        const remove = ["pharmacology", "pathology", "clinical", "anatomy"].includes(value)
          ? ""
          : `<button type="button" class="chip-remove" data-action="remove-category" data-value="${escapeHtml(value)}">✕</button>`;
        const label = value.charAt(0).toUpperCase() + value.slice(1);
        return `<div class="category-chip-wrap"><button type="button" class="chip ${active}" data-value="${escapeHtml(value)}">${escapeHtml(label)}</button>${remove}</div>`;
      })
      .join("");
  }

  function updateMetrics(items) {
    const tasks = items.filter((i) => i.module === "task");
    const posts = items.filter((i) => i.module === "post");
    const videos = items.filter((i) => i.module === "video");
    const notes = items.filter((i) => i.module === "note");
    const revenue = items.filter((i) => i.module === "revenue");

    const videosInProgress = videos.filter((v) => !v.completed && (v.meta?.status || "") === "in-progress").length;
    const upcomingPosts = posts.filter((p) => !p.completed && isDueSoon(p.dueDate, 7)).length;
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
  }

  function renderNotifications(items) {
    const notifications = [];

    items.filter((i) => i.module === "task" && !i.completed).forEach((task) => {
      if (isDueSoon(task.dueDate, 2)) notifications.push(`Task due: ${task.title} (${formatDate(task.dueDate)})`);
    });

    items.filter((i) => i.module === "post" && !i.completed).forEach((post) => {
      if (isDueSoon(post.dueDate, 2)) notifications.push(`Post scheduled: ${post.title} (${formatDate(post.dueDate)})`);
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

  function render() {
    const items = S.loadItems();
    updateMetrics(items);
    renderIdeaCategories();
    renderNotifications(items);

    renderModule(
      "tasksList",
      items.filter((i) => i.module === "task"),
      (item) => [`Category: ${item.category || "-"}`, `Due: ${formatDate(item.dueDate)}`, item.description ? `Description: ${item.description}` : ""].filter(Boolean),
      "No active tasks.",
      "No completed tasks."
    );

    renderModule(
      "ideasList",
      items.filter((i) => i.module === "idea"),
      (item) => [`Category: ${item.category || "-"}`, item.description ? `Description: ${item.description}` : ""].filter(Boolean),
      "No active ideas.",
      "No completed ideas."
    );

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
      (item) => [`Type: ${item.category || "-"}`, `Status: ${item.meta?.status || "-"}`, `Platform: ${item.meta?.platform || "-"}`, `Date: ${formatDate(item.dueDate)}`],
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
  }

  window.ManPharmaUI = {
    render,
    renderIdeaCategories,
    formatDate
  };
})();
