const STORAGE_KEY = "manpharma_offline_data_v1";
const DEFAULT_BRAND_TITLE = "ManPharma Tutorials";
const DEFAULT_BRAND_TAGLINE = "In the process of building a 1000 crore EdTech brand";
const DEFAULT_IDEA_CATEGORIES = ["pharmacology", "pathology", "clinical", "anatomy"];

const defaultData = {
  tasks: [],
  posts: [],
  notes: [],
  ideas: [],
  videos: [],
  revenue: [],
  ideaCategories: [...DEFAULT_IDEA_CATEGORIES],
  branding: {
    title: DEFAULT_BRAND_TITLE,
    tagline: DEFAULT_BRAND_TAGLINE,
    logoData: "",
    logoCircle: true,
    logoPosX: 50,
    logoPosY: 50
  }
};

let data = loadData();
let activeView = "dashboardView";

function q(sel) { return document.querySelector(sel); }
function qa(sel) { return Array.from(document.querySelectorAll(sel)); }

function uid(prefix = "item") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeCategory(raw) {
  return String(raw || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function titleCase(text) {
  return String(text || "")
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return normalizeData(structuredClone(defaultData));
    const parsed = JSON.parse(raw);
    return normalizeData({
      ...structuredClone(defaultData),
      ...parsed,
      branding: { ...defaultData.branding, ...(parsed.branding || {}) }
    });
  } catch {
    return normalizeData(structuredClone(defaultData));
  }
}

function normalizeData(source) {
  const next = source;

  const ensureItem = (item, prefix, fallbackPriority = "medium") => ({
    id: item.id || uid(prefix),
    completed: Boolean(item.completed || item.done),
    completedAt: item.completedAt || "",
    priority: item.priority || fallbackPriority
  });

  next.tasks = (next.tasks || []).map((t) => ({ ...t, ...ensureItem(t, "task") }));
  next.posts = (next.posts || []).map((p) => ({ ...p, ...ensureItem(p, "post") }));
  next.notes = (next.notes || []).map((n) => ({ ...n, ...ensureItem(n, "note") }));
  next.ideas = (next.ideas || []).map((i) => ({ ...i, ...ensureItem(i, "idea") }));
  next.videos = (next.videos || []).map((v) => ({ ...v, ...ensureItem(v, "video") }));
  next.revenue = next.revenue || [];

  const cats = (next.ideaCategories || []).map(normalizeCategory).filter(Boolean);
  next.ideaCategories = [...new Set((cats.length ? cats : DEFAULT_IDEA_CATEGORIES).map(normalizeCategory))];

  next.branding.logoCircle = next.branding.logoCircle !== false;
  next.branding.logoPosX = Number.isFinite(Number(next.branding.logoPosX)) ? Number(next.branding.logoPosX) : 50;
  next.branding.logoPosY = Number.isFinite(Number(next.branding.logoPosY)) ? Number(next.branding.logoPosY) : 50;

  return next;
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function selectedValue(groupName) {
  const btn = q(`[data-chip-group="${groupName}"] .chip.active`);
  return btn ? btn.dataset.value : "";
}

function setActiveChip(groupName, value) {
  const wrap = q(`[data-chip-group="${groupName}"]`);
  if (!wrap) return;
  const normalized = String(value || "").toLowerCase();
  const chips = qa(`[data-chip-group="${groupName}"] .chip`);
  chips.forEach((chip) => chip.classList.remove("active"));
  const target = chips.find((chip) => chip.dataset.value === normalized) || chips[0];
  if (target) target.classList.add("active");
}

function selectChip(btn) {
  const wrap = btn.closest("[data-chip-group]");
  if (!wrap) return;
  wrap.querySelectorAll(".chip").forEach((x) => x.classList.remove("active"));
  btn.classList.add("active");
}

function openModal(id) {
  q("#overlay").classList.remove("hidden");
  q(`#${id}`).classList.remove("hidden");
}

function closeModals() {
  q("#overlay").classList.add("hidden");
  qa(".modal").forEach((m) => m.classList.add("hidden"));
}

function setView(id) {
  qa("main.content").forEach((v) => v.classList.add("hidden"));
  q(`#${id}`).classList.remove("hidden");
  qa(".nav-btn").forEach((n) => n.classList.toggle("active", n.dataset.view === id));
  activeView = id;
}

function isDueSoon(dateStr, days = 2) {
  if (!dateStr) return false;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(dateStr + "T00:00:00");
  const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  return diff <= days;
}

function buildNotifications() {
  const notifications = [];

  data.tasks.forEach((t) => {
    if (t.completed) return;
    if (isDueSoon(t.dueDate)) notifications.push(`Task due: ${t.title} (${formatDateFromYMD(t.dueDate)})`);
  });

  data.posts.forEach((p) => {
    if (p.completed || p.status === "posted") return;
    if (isDueSoon(p.date)) notifications.push(`Post scheduled: ${p.title} (${formatDateFromYMD(p.date)})`);
  });

  return notifications;
}

function requestBrowserNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") Notification.requestPermission();
}

function pushBrowserNotifications(notifications) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted" || !notifications.length) return;

  const key = "manpharma_last_notification";
  const body = notifications.slice(0, 3).join(" | ");
  if (localStorage.getItem(key) === body) return;
  localStorage.setItem(key, body);

  new Notification("ManPharma Due Alerts", { body });
}

function formatDate(s) {
  if (!s) return "-";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateFromYMD(s) {
  if (!s) return "-";
  const d = new Date(s + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function renderBranding() {
  const title = (data.branding.title || DEFAULT_BRAND_TITLE).trim();
  const tagline = (data.branding.tagline || DEFAULT_BRAND_TAGLINE).trim();

  q("#brandTitle").textContent = title || DEFAULT_BRAND_TITLE;
  q("#brandTagline").textContent = tagline || DEFAULT_BRAND_TAGLINE;
  q("#brandingTitleInput").value = title || DEFAULT_BRAND_TITLE;
  q("#brandingTaglineInput").value = tagline || DEFAULT_BRAND_TAGLINE;

  const logoEl = q("#brandLogo");
  const fallbackEl = q("#brandLogoFallback");
  const logoWrap = q(".brand-logo-box.large");

  q("#logoCircleToggle").checked = data.branding.logoCircle;
  q("#logoPosX").value = String(data.branding.logoPosX);
  q("#logoPosY").value = String(data.branding.logoPosY);

  logoWrap.classList.toggle("crop-circle", Boolean(data.branding.logoCircle));
  logoEl.style.objectPosition = `${data.branding.logoPosX}% ${data.branding.logoPosY}%`;

  if (data.branding.logoData) {
    logoEl.src = data.branding.logoData;
    logoEl.classList.remove("hidden");
    fallbackEl.classList.add("hidden");
  } else {
    logoEl.removeAttribute("src");
    logoEl.classList.add("hidden");
    fallbackEl.classList.remove("hidden");
  }
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function isValidLogoFile(file) {
  if (!file) return false;
  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();
  const validType = ["image/jpeg", "image/png", "image/svg+xml"].includes(type);
  const validExt = [".jpg", ".jpeg", ".png", ".svg"].some((ext) => name.endsWith(ext));
  return validType || validExt;
}

async function saveLogoFile(file) {
  if (!isValidLogoFile(file)) {
    alert("Please select a JPG, PNG, or SVG file.");
    return;
  }
  data.branding.logoData = await fileToDataURL(file);
  renderBranding();
  saveData();
}

function renderIdeaCategories() {
  const wrap = q("#ideaCategoryChips");
  const selected = selectedValue("ideaCategory") || data.ideaCategories[0] || "pharmacology";

  wrap.innerHTML = data.ideaCategories
    .map((category) => {
      const value = normalizeCategory(category);
      const active = value === selected ? "active" : "";
      const custom = DEFAULT_IDEA_CATEGORIES.includes(value) ? "" :
        `<button type="button" class="chip-remove" data-action="remove-category" data-value="${escapeHtml(value)}" aria-label="Remove ${escapeHtml(value)}">✕</button>`;
      return `<div class="category-chip-wrap"><button type="button" class="chip ${active}" data-value="${escapeHtml(value)}">${escapeHtml(titleCase(value))}</button>${custom}</div>`;
    })
    .join("");

  setActiveChip("ideaCategory", selected);
}

function priorityClass(priority) {
  const val = String(priority || "medium").toLowerCase();
  if (val === "high") return "high";
  if (val === "low") return "low";
  return "medium";
}

function priorityBadge(priority) {
  const cls = priorityClass(priority);
  const label = cls.charAt(0).toUpperCase() + cls.slice(1);
  return `<span class="priority-badge ${cls}">${label}</span>`;
}

function itemCardHtml(collection, item, lines) {
  const completedClass = item.completed ? "completed" : "";
  const disabledEdit = item.completed ? "disabled title=\"Uncheck to edit\"" : "";
  const completeLine = item.completedAt ? `<p class="meta-line">Completed: ${formatDate(item.completedAt)}</p>` : "";

  return `
    <article class="list-item ${completedClass}">
      <div class="item-top">
        <div class="item-title-wrap">
          <input class="toggle-box" type="checkbox" data-action="toggle" data-collection="${collection}" data-id="${item.id}" ${item.completed ? "checked" : ""} />
          <div>
            <span class="item-title">${escapeHtml(item.title || "Untitled")}</span>
            <div>${priorityBadge(item.priority)}</div>
          </div>
        </div>
        <div class="item-actions">
          <button class="edit-btn" data-action="edit" data-collection="${collection}" data-id="${item.id}" aria-label="Edit" ${disabledEdit}>✏️</button>
          <button class="delete-btn" data-action="delete" data-collection="${collection}" data-id="${item.id}" aria-label="Delete">🗑️</button>
        </div>
      </div>
      ${lines.map((line) => `<p class="meta-line">${escapeHtml(line)}</p>`).join("")}
      ${completeLine}
    </article>
  `;
}

function renderCollection(containerId, collection, lineBuilder, emptyActive, emptyCompleted) {
  const container = q(`#${containerId}`);
  const items = [...data[collection]];
  const active = items.filter((i) => !i.completed);
  const completed = items
    .filter((i) => i.completed)
    .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime());

  const activeHtml = active.length
    ? active.map((item) => itemCardHtml(collection, item, lineBuilder(item))).join("")
    : `<p class="meta-line">${escapeHtml(emptyActive)}</p>`;

  const completedHtml = completed.length
    ? completed.map((item) => itemCardHtml(collection, item, lineBuilder(item))).join("")
    : `<p class="meta-line">${escapeHtml(emptyCompleted)}</p>`;

  container.innerHTML = `
    <section>
      <p class="meta-line"><strong>Active Items</strong></p>
      ${activeHtml}
    </section>
    <section class="completed-wrap">
      <details class="completed-box">
        <summary>Completed Items (${completed.length})</summary>
        <div class="list">${completedHtml}</div>
      </details>
    </section>
  `;
}

function render() {
  renderBranding();
  renderIdeaCategories();

  const videosInProgress = data.videos.filter((v) => !v.completed && v.status === "in-progress").length;
  const upcomingPosts = data.posts.filter((p) => !p.completed && p.status === "scheduled" && isDueSoon(p.date, 7)).length;
  const pendingTasks = data.tasks.filter((t) => !t.completed).length;
  const monthIncome = data.revenue.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  q("#videosInProgress").textContent = videosInProgress;
  q("#upcomingPosts").textContent = upcomingPosts;
  q("#pendingTasks").textContent = pendingTasks;
  q("#monthIncome").textContent = `₹${monthIncome}`;
  q("#totalVideosText").textContent = `${data.videos.length} total videos`;
  q("#totalVideos").textContent = data.videos.length;
  q("#totalNotes").textContent = data.notes.length;

  q("#aTasks").textContent = data.tasks.length;
  q("#aPosts").textContent = data.posts.length;
  q("#aNotes").textContent = data.notes.length;
  q("#aIdeas").textContent = data.ideas.length;
  q("#aVideos").textContent = data.videos.length;

  renderCollection(
    "tasksList",
    "tasks",
    (t) => [`Category: ${t.category || "-"}`, `Due: ${formatDateFromYMD(t.dueDate)}`, t.desc ? `Description: ${t.desc}` : ""].filter(Boolean),
    "No active tasks.",
    "No completed tasks."
  );

  renderCollection(
    "notesList",
    "notes",
    (n) => [`Subject: ${n.subject || "-"}`, `Progress: ${n.progress ?? 0}%`, n.content ? `Notes: ${n.content}` : ""].filter(Boolean),
    "No active notes.",
    "No completed notes."
  );

  renderCollection(
    "ideasList",
    "ideas",
    (i) => [`Category: ${i.category || "-"}`, i.description ? `Description: ${i.description}` : ""].filter(Boolean),
    "No active ideas.",
    "No completed ideas."
  );

  renderCollection(
    "postsList",
    "posts",
    (p) => [`Type: ${p.type || "-"}`, `Status: ${p.status || "-"}`, `Platform: ${p.platform || "-"}`, `Date: ${formatDateFromYMD(p.date)}`],
    "No active posts.",
    "No completed posts."
  );

  renderCollection(
    "videosList",
    "videos",
    (v) => [`Status: ${v.status || "-"}`],
    "No active videos.",
    "No completed videos."
  );

  const notifications = buildNotifications();
  q("#notifyCount").textContent = notifications.length;
  q("#notifyCount").classList.toggle("hidden", notifications.length === 0);
  q("#notificationList").innerHTML = notifications.length
    ? notifications.map((n) => `<li>${escapeHtml(n)}</li>`).join("")
    : "<li>No due alerts right now.</li>";

  saveData();
}

function updateCompletion(collection, id, checked) {
  const item = data[collection].find((x) => x.id === id);
  if (!item) return;
  item.completed = checked;
  if (collection === "tasks") item.done = checked;
  item.completedAt = checked ? new Date().toISOString() : "";
  render();
}

function deleteItem(collection, id) {
  if (!confirm("Delete this item permanently?")) return;
  data[collection] = data[collection].filter((item) => item.id !== id);
  render();
}

function getItemById(collection, id) {
  return data[collection].find((x) => x.id === id);
}

function resetFormMode(formId, modalId, title) {
  const form = q(`#${formId}`);
  form.reset();
  form.elements.editId.value = "";
  if (modalId && title) q(`#${modalId} h2`).textContent = title;
}

function editItem(collection, id) {
  const item = getItemById(collection, id);
  if (!item) return;
  if (item.completed) return;

  if (collection === "tasks") {
    q("#taskModal h2").textContent = "Edit Task";
    const f = q("#taskForm");
    f.elements.editId.value = item.id;
    f.elements.title.value = item.title || "";
    f.elements.desc.value = item.desc || "";
    f.elements.dueDate.value = item.dueDate || "";
    setActiveChip("taskPriority", item.priority || "medium");
    setActiveChip("taskCategory", item.category || "content");
    openModal("taskModal");
    return;
  }

  if (collection === "posts") {
    q("#postModal h2").textContent = "Edit Post";
    const f = q("#postForm");
    f.elements.editId.value = item.id;
    f.elements.title.value = item.title || "";
    f.elements.date.value = item.date || "";
    setActiveChip("postType", item.type || "video");
    setActiveChip("postStatus", item.status || "scheduled");
    setActiveChip("platform", item.platform || "youtube");
    setActiveChip("postPriority", item.priority || "medium");
    openModal("postModal");
    return;
  }

  if (collection === "notes") {
    q("#noteModal h2").textContent = "Edit Study Note";
    const f = q("#noteForm");
    f.elements.editId.value = item.id;
    f.elements.title.value = item.title || "";
    f.elements.subject.value = item.subject || "";
    f.elements.content.value = item.content || "";
    f.elements.progress.value = Number(item.progress || 0);
    q("#progressLabel").textContent = String(Number(item.progress || 0));
    setActiveChip("notePriority", item.priority || "medium");
    openModal("noteModal");
    return;
  }

  if (collection === "ideas") {
    q("#ideaModal h2").textContent = "Edit Idea";
    const f = q("#ideaForm");
    f.elements.editId.value = item.id;
    f.elements.title.value = item.title || "";
    f.elements.description.value = item.description || "";
    if (!data.ideaCategories.includes(normalizeCategory(item.category))) {
      data.ideaCategories.push(normalizeCategory(item.category));
      renderIdeaCategories();
    }
    setActiveChip("ideaCategory", item.category || data.ideaCategories[0]);
    setActiveChip("ideaPriority", item.priority || "medium");
    openModal("ideaModal");
    return;
  }

  if (collection === "videos") {
    q("#videoModal h2").textContent = "Edit Video";
    const f = q("#videoForm");
    f.elements.editId.value = item.id;
    f.elements.title.value = item.title || "";
    setActiveChip("videoStatus", item.status || "in-progress");
    setActiveChip("videoPriority", item.priority || "medium");
    openModal("videoModal");
  }
}

function saveOrUpdate(collection, payload, id) {
  if (id) {
    const idx = data[collection].findIndex((x) => x.id === id);
    if (idx >= 0) {
      const prev = data[collection][idx];
      data[collection][idx] = { ...prev, ...payload, id: prev.id };
      return;
    }
  }
  data[collection].unshift({
    id: uid(collection.slice(0, -1)),
    completed: false,
    completedAt: "",
    ...payload
  });
}

function removeIdeaCategory(value) {
  const normalized = normalizeCategory(value);
  if (!normalized || DEFAULT_IDEA_CATEGORIES.includes(normalized)) return;

  if (!confirm(`Delete custom category "${titleCase(normalized)}"?`)) return;

  const fallback = data.ideaCategories.find((c) => DEFAULT_IDEA_CATEGORIES.includes(c)) || "pharmacology";
  data.ideas.forEach((idea) => {
    if (normalizeCategory(idea.category) === normalized) idea.category = fallback;
  });

  data.ideaCategories = data.ideaCategories.filter((c) => normalizeCategory(c) !== normalized);
  render();
}

function bindUI() {
  qa("[data-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.open;
      if (target === "taskModal") {
        resetFormMode("taskForm", "taskModal", "New Task");
        setActiveChip("taskPriority", "medium");
        setActiveChip("taskCategory", "content");
      }
      if (target === "postModal") {
        resetFormMode("postForm", "postModal", "Schedule Post");
        setActiveChip("postType", "video");
        setActiveChip("postStatus", "scheduled");
        setActiveChip("platform", "youtube");
        setActiveChip("postPriority", "medium");
      }
      if (target === "noteModal") {
        resetFormMode("noteForm", "noteModal", "New Study Note");
        q("#progressLabel").textContent = "0";
        setActiveChip("notePriority", "medium");
      }
      if (target === "ideaModal") {
        resetFormMode("ideaForm", "ideaModal", "New Idea");
        setActiveChip("ideaPriority", "medium");
      }
      if (target === "videoModal") {
        resetFormMode("videoForm", "videoModal", "New Video");
        setActiveChip("videoStatus", "in-progress");
        setActiveChip("videoPriority", "medium");
      }
      openModal(target);
    });
  });

  qa("[data-close]").forEach((btn) => btn.addEventListener("click", closeModals));
  q("#overlay").addEventListener("click", closeModals);

  document.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (chip) selectChip(chip);

    const delBtn = e.target.closest('[data-action="delete"]');
    if (delBtn) deleteItem(delBtn.dataset.collection, delBtn.dataset.id);

    const editBtn = e.target.closest('[data-action="edit"]');
    if (editBtn) editItem(editBtn.dataset.collection, editBtn.dataset.id);

    const removeCatBtn = e.target.closest('[data-action="remove-category"]');
    if (removeCatBtn) removeIdeaCategory(removeCatBtn.dataset.value);
  });

  document.addEventListener("change", (e) => {
    const toggle = e.target.closest('[data-action="toggle"]');
    if (toggle) updateCompletion(toggle.dataset.collection, toggle.dataset.id, toggle.checked);
  });

  qa(".nav-btn").forEach((btn) => btn.addEventListener("click", () => setView(btn.dataset.view)));

  q("#notifyButton").addEventListener("click", () => {
    q("#notificationPanel").classList.toggle("hidden");
    if (activeView !== "dashboardView") setView("dashboardView");
  });

  q("#progress").addEventListener("input", (e) => {
    q("#progressLabel").textContent = e.target.value;
  });

  q("#taskForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    saveOrUpdate(
      "tasks",
      {
        title: String(fd.get("title") || ""),
        desc: String(fd.get("desc") || ""),
        dueDate: String(fd.get("dueDate") || ""),
        priority: selectedValue("taskPriority") || "medium",
        category: selectedValue("taskCategory") || "content",
        done: false
      },
      String(fd.get("editId") || "")
    );
    closeModals();
    render();
  });

  q("#postForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    saveOrUpdate(
      "posts",
      {
        title: String(fd.get("title") || ""),
        type: selectedValue("postType") || "video",
        status: selectedValue("postStatus") || "scheduled",
        platform: selectedValue("platform") || "youtube",
        priority: selectedValue("postPriority") || "medium",
        date: String(fd.get("date") || "")
      },
      String(fd.get("editId") || "")
    );
    closeModals();
    render();
  });

  q("#noteForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    saveOrUpdate(
      "notes",
      {
        title: String(fd.get("title") || ""),
        subject: String(fd.get("subject") || ""),
        content: String(fd.get("content") || ""),
        priority: selectedValue("notePriority") || "medium",
        progress: Number(fd.get("progress") || 0)
      },
      String(fd.get("editId") || "")
    );
    closeModals();
    render();
  });

  q("#ideaForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    saveOrUpdate(
      "ideas",
      {
        title: String(fd.get("title") || ""),
        description: String(fd.get("description") || ""),
        category: selectedValue("ideaCategory") || data.ideaCategories[0],
        priority: selectedValue("ideaPriority") || "medium"
      },
      String(fd.get("editId") || "")
    );
    closeModals();
    render();
  });

  q("#revenueForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    data.revenue.unshift({ amount: Number(fd.get("amount") || 0), source: String(fd.get("source") || "") });
    closeModals();
    render();
  });

  q("#videoForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    saveOrUpdate(
      "videos",
      {
        title: String(fd.get("title") || ""),
        status: selectedValue("videoStatus") || "in-progress",
        priority: selectedValue("videoPriority") || "medium"
      },
      String(fd.get("editId") || "")
    );
    closeModals();
    render();
  });

  const logoInput = q("#logoInput");
  q("#replaceLogoBtn").addEventListener("click", () => logoInput.click());

  logoInput.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      await saveLogoFile(file);
    } catch {
      alert("Logo upload failed. Please try a different file.");
    }
    logoInput.value = "";
  });

  q("#removeLogoBtn").addEventListener("click", () => {
    data.branding.logoData = "";
    renderBranding();
    saveData();
  });

  q("#logoCircleToggle").addEventListener("change", (e) => {
    data.branding.logoCircle = e.target.checked;
    renderBranding();
    saveData();
  });

  q("#logoPosX").addEventListener("input", (e) => {
    data.branding.logoPosX = Number(e.target.value || 50);
    renderBranding();
    saveData();
  });

  q("#logoPosY").addEventListener("input", (e) => {
    data.branding.logoPosY = Number(e.target.value || 50);
    renderBranding();
    saveData();
  });

  q("#brandingForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    data.branding.title = String(fd.get("brandTitle") || DEFAULT_BRAND_TITLE).trim() || DEFAULT_BRAND_TITLE;
    data.branding.tagline = String(fd.get("brandTagline") || DEFAULT_BRAND_TAGLINE).trim() || DEFAULT_BRAND_TAGLINE;
    closeModals();
    render();
  });

  q("#addIdeaCategoryBtn").addEventListener("click", () => {
    const input = q("#newIdeaCategoryInput");
    const value = normalizeCategory(input.value);
    if (!value) return;

    if (data.ideaCategories.includes(value)) {
      setActiveChip("ideaCategory", value);
      input.value = "";
      return;
    }

    data.ideaCategories.push(value);
    input.value = "";
    renderIdeaCategories();
    setActiveChip("ideaCategory", value);
    saveData();
  });

  q("#newIdeaCategoryInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      q("#addIdeaCategoryBtn").click();
    }
  });
}

function startDueChecks() {
  const run = () => {
    const notifications = buildNotifications();
    pushBrowserNotifications(notifications);
    render();
  };
  run();
  setInterval(run, 60 * 1000);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").then((reg) => {
      reg.update().catch(() => {});
      setInterval(() => reg.update().catch(() => {}), 60 * 1000);
    }).catch(() => {});

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (sessionStorage.getItem("sw_reloaded")) return;
      sessionStorage.setItem("sw_reloaded", "1");
      window.location.reload();
    });
  });
}

bindUI();
setView("dashboardView");
requestBrowserNotificationPermission();
render();
startDueChecks();
registerServiceWorker();
