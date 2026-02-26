(function () {
  const DATA_KEY = "manpharma_data";
  const META_KEY = "manpharma_meta";
  const LEGACY_KEY = "manpharma_offline_data_v1";
  const DEFAULT_META = { ideaCategories: ["pharmacology", "pathology", "clinical", "anatomy"] };

  function uid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function normalizeText(v) {
    return String(v || "").trim();
  }

  function normalizeCategory(v) {
    return normalizeText(v).toLowerCase().replace(/\s+/g, " ");
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function safeJsonParse(raw, fallback) {
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function baseItem(partial) {
    const item = partial || {};
    return {
      id: item.id || uid(),
      type: item.type || "task",
      module: item.module || item.type || "task",
      title: normalizeText(item.title),
      description: normalizeText(item.description),
      category: normalizeCategory(item.category),
      priority: normalizeCategory(item.priority) || "medium",
      dueDate: normalizeText(item.dueDate),
      completed: Boolean(item.completed),
      completedAt: item.completedAt || null,
      createdAt: item.createdAt || nowIso(),
      meta: item.meta || {}
    };
  }

  function loadItems() {
    const raw = localStorage.getItem(DATA_KEY);
    const parsed = safeJsonParse(raw || "[]", []);
    return Array.isArray(parsed) ? parsed.map(baseItem) : [];
  }

  function saveItems(items) {
    const next = Array.isArray(items) ? items.map(baseItem) : [];
    localStorage.setItem(DATA_KEY, JSON.stringify(next));
    return next;
  }

  function loadMeta() {
    const raw = localStorage.getItem(META_KEY);
    const parsed = safeJsonParse(raw || "{}", {});
    const ideaCategories = Array.isArray(parsed.ideaCategories)
      ? parsed.ideaCategories.map(normalizeCategory).filter(Boolean)
      : DEFAULT_META.ideaCategories.slice();
    return {
      ...DEFAULT_META,
      ...parsed,
      ideaCategories: [...new Set(ideaCategories.length ? ideaCategories : DEFAULT_META.ideaCategories)]
    };
  }

  function saveMeta(meta) {
    const next = {
      ...DEFAULT_META,
      ...(meta || {})
    };
    next.ideaCategories = [...new Set((next.ideaCategories || []).map(normalizeCategory).filter(Boolean))];
    localStorage.setItem(META_KEY, JSON.stringify(next));
    return next;
  }

  function migrateLegacyIfNeeded() {
    if (loadItems().length > 0) return;

    const legacyRaw = localStorage.getItem(LEGACY_KEY);
    if (!legacyRaw) return;
    const legacy = safeJsonParse(legacyRaw, null);
    if (!legacy || typeof legacy !== "object") return;

    const items = [];
    const push = (obj) => items.push(baseItem(obj));

    (legacy.tasks || []).forEach((t) => push({
      id: t.id,
      type: "task",
      module: "task",
      title: t.title,
      description: t.desc,
      category: t.category,
      priority: t.priority,
      dueDate: t.dueDate,
      completed: Boolean(t.completed || t.done),
      completedAt: t.completedAt || null,
      createdAt: t.createdAt || nowIso(),
      meta: {}
    }));

    (legacy.ideas || []).forEach((i) => push({
      id: i.id,
      type: "idea",
      module: "idea",
      title: i.title,
      description: i.description,
      category: i.category,
      priority: i.priority,
      dueDate: "",
      completed: Boolean(i.completed),
      completedAt: i.completedAt || null,
      createdAt: i.createdAt || nowIso(),
      meta: {}
    }));

    (legacy.notes || []).forEach((n) => push({
      id: n.id,
      type: "note",
      module: "note",
      title: n.title,
      description: n.content,
      category: n.subject,
      priority: n.priority || "medium",
      dueDate: "",
      completed: Boolean(n.completed),
      completedAt: n.completedAt || null,
      createdAt: n.createdAt || nowIso(),
      meta: { progress: Number(n.progress || 0) }
    }));

    (legacy.posts || []).forEach((p) => push({
      id: p.id,
      type: "content",
      module: "post",
      title: p.title,
      description: `${p.status || ""} ${p.platform || ""}`.trim(),
      category: p.type || "post",
      priority: p.priority || "medium",
      dueDate: p.date,
      completed: Boolean(p.completed),
      completedAt: p.completedAt || null,
      createdAt: p.createdAt || nowIso(),
      meta: { status: p.status || "scheduled", platform: p.platform || "youtube" }
    }));

    (legacy.videos || []).forEach((v) => push({
      id: v.id,
      type: "content",
      module: "video",
      title: v.title,
      description: v.status || "",
      category: "video",
      priority: v.priority || "medium",
      dueDate: "",
      completed: Boolean(v.completed),
      completedAt: v.completedAt || null,
      createdAt: v.createdAt || nowIso(),
      meta: { status: v.status || "in-progress" }
    }));

    (legacy.revenue || []).forEach((r) => push({
      id: r.id,
      type: "revenue",
      module: "revenue",
      title: r.source || "Revenue",
      description: `₹${Number(r.amount || 0)}`,
      category: "income",
      priority: "low",
      dueDate: "",
      completed: Boolean(r.completed),
      completedAt: r.completedAt || null,
      createdAt: r.createdAt || nowIso(),
      meta: { amount: Number(r.amount || 0), source: r.source || "" }
    }));

    saveItems(items);

    const meta = loadMeta();
    const extraCats = Array.isArray(legacy.ideaCategories) ? legacy.ideaCategories : [];
    saveMeta({ ...meta, ideaCategories: [...meta.ideaCategories, ...extraCats] });
  }

  function upsertItem(payload) {
    const item = baseItem(payload);
    const items = loadItems();
    const idx = items.findIndex((x) => x.id === item.id);
    if (idx >= 0) {
      const prev = items[idx];
      items[idx] = baseItem({
        ...prev,
        ...item,
        createdAt: prev.createdAt,
        completed: prev.completed,
        completedAt: prev.completedAt
      });
    } else {
      items.unshift(item);
    }
    return saveItems(items);
  }

  function deleteItem(id) {
    const items = loadItems().filter((item) => item.id !== id);
    return saveItems(items);
  }

  function toggleComplete(id, completed) {
    const items = loadItems().map((item) => {
      if (item.id !== id) return item;
      return {
        ...item,
        completed: Boolean(completed),
        completedAt: completed ? nowIso() : null
      };
    });
    return saveItems(items);
  }

  function getById(id) {
    return loadItems().find((item) => item.id === id) || null;
  }

  function addIdeaCategory(rawValue) {
    const value = normalizeCategory(rawValue);
    if (!value) return loadMeta();
    const meta = loadMeta();
    if (!meta.ideaCategories.includes(value)) {
      meta.ideaCategories.push(value);
      saveMeta(meta);
    }
    return meta;
  }

  function removeIdeaCategory(rawValue) {
    const value = normalizeCategory(rawValue);
    if (!value) return;

    const meta = loadMeta();
    meta.ideaCategories = meta.ideaCategories.filter((c) => c !== value);
    if (!meta.ideaCategories.length) meta.ideaCategories = ["general"];
    saveMeta(meta);

    const fallback = meta.ideaCategories[0];
    const items = loadItems().map((item) => {
      if (item.module !== "idea") return item;
      if (item.category !== value) return item;
      return { ...item, category: fallback };
    });
    saveItems(items);
  }

  function listByModule(module) {
    return loadItems().filter((item) => item.module === module);
  }

  window.ManPharmaStorage = {
    DATA_KEY,
    META_KEY,
    migrateLegacyIfNeeded,
    loadItems,
    saveItems,
    loadMeta,
    saveMeta,
    upsertItem,
    deleteItem,
    toggleComplete,
    getById,
    addIdeaCategory,
    removeIdeaCategory,
    listByModule,
    baseItem,
    normalizeCategory
  };
})();
