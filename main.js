(function () {
  const S = window.ManPharmaStorage;
  const UI = window.ManPharmaUI;
  const BRAND_TITLE_KEY = "manpharma_brand_title";
  const BRAND_TAGLINE_KEY = "manpharma_brand_tagline";
  const BRAND_LOGO_KEY = "manpharma_logo";
  const LAST_NOTIFICATION_KEY = "manpharma_last_notification";
  const NOTIFICATION_HINT_KEY = "manpharma_notification_hint_seen";
  const SYNC_CONFIG_KEY = "manpharma_sync_config";
  const DEFAULT_BRAND_TITLE = "ManPharma Tutorials";
  const DEFAULT_BRAND_TAGLINE = "In the process of building a 1000 crore EdTech brand";
  const MOBILE_CHROME_QUERY = "(max-width: 56rem)";
  const SCROLL_DELTA_THRESHOLD = 18;
  const COMPACT_HEADER_TRIGGER = 56;
  const FILTER_HIDE_TRIGGER = 118;
  const NAV_HIDE_TRIGGER = 192;

  function q(sel) { return document.querySelector(sel); }
  function qa(sel) { return Array.from(document.querySelectorAll(sel)); }
  const chromeState = {
    activeViewId: "dashboardView",
    lastScrollTop: 0,
    ticking: false,
    compactHeader: false,
    filterHidden: false,
    bottomNavHidden: false
  };

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }

  function localDateKey(dateObj) {
    const d = dateObj instanceof Date ? dateObj : new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function parseDueDate(dateStr) {
    if (!dateStr) return null;
    const due = String(dateStr).includes("T") ? new Date(dateStr) : new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(due.getTime())) return null;
    return due;
  }

  function isDueNowOrPast(dateStr) {
    const due = parseDueDate(dateStr);
    if (!due) return false;
    return Date.now() >= due.getTime();
  }

  function getNotificationDate(item) {
    return parseDueDate(item ? item.dueDate : "");
  }

  function isItemNotificationDue(item) {
    const notifyAt = getNotificationDate(item);
    if (!notifyAt) return false;
    return Date.now() >= notifyAt.getTime();
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

  function dueNotificationRecords(items) {
    const alerts = [];

    items.filter((i) => i.module === "task" && !i.completed).forEach((task) => {
      if (isItemNotificationDue(task)) {
        alerts.push({
          id: task.id,
          dueDate: task.dueDate,
          text: `Task due: ${task.title} (${formatDate(task.dueDate)})`
        });
      }
    });

    items.filter((i) => i.module === "post" && !i.completed).forEach((post) => {
      if (isItemNotificationDue(post)) {
        alerts.push({
          id: post.id,
          dueDate: post.dueDate,
          text: `Post scheduled: ${post.title} (${formatDate(post.dueDate)})`
        });
      }
    });

    return alerts;
  }

  function requestNotificationPermissionFromUserAction() {
    if (!("Notification" in window)) return;
    if (!window.isSecureContext) return;
    if (Notification.permission !== "default") return;
    Notification.requestPermission().catch(() => {});
  }

  function pushDueBrowserNotification() {
    if (!("Notification" in window)) return;
    if (!window.isSecureContext) return;
    if (Notification.permission !== "granted") return;

    const records = dueNotificationRecords(S.loadItems());
    if (!records.length) return;

    const rawSent = localStorage.getItem(LAST_NOTIFICATION_KEY);
    const sentMap = (() => {
      try {
        const parsed = JSON.parse(rawSent || "{}");
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch {
        return {};
      }
    })();

    const unsent = records.filter((r) => sentMap[r.id] !== r.dueDate);
    if (!unsent.length) return;

    unsent.forEach((r) => { sentMap[r.id] = r.dueDate; });
    localStorage.setItem(LAST_NOTIFICATION_KEY, JSON.stringify(sentMap));

    const body = unsent.slice(0, 3).map((r) => r.text).join(" | ");

    try {
      new Notification("ManPharma Due Alerts", { body });
    } catch (_) {}
  }

  function updateNotifyBadge() {
    const badge = q("#notifyCount");
    if (!badge) return;
    const count = dueNotificationRecords(S.loadItems()).length;
    badge.textContent = String(count);
    badge.classList.toggle("hidden", count === 0);
  }

  function startNotificationChecks() {
    pushDueBrowserNotification();
    updateNotifyBadge();
    setInterval(() => {
      if (document.visibilityState === "visible") {
        pushDueBrowserNotification();
        updateNotifyBadge();
      }
    }, 60 * 1000);
  }

  const modalTitles = {
    taskModal: "New Task",
    ideaModal: "New Idea",
    postModal: "Schedule Post",
    videoModal: "New Video",
    revenueModal: "Add Revenue"
  };

  const moduleToModal = {
    task: { modalId: "taskModal", formId: "taskForm" },
    idea: { modalId: "ideaModal", formId: "ideaForm" },
    post: { modalId: "postModal", formId: "postForm" },
    video: { modalId: "videoModal", formId: "videoForm" },
    revenue: { modalId: "revenueModal", formId: "revenueForm" }
  };

  function getBranding() {
    const title = String(localStorage.getItem(BRAND_TITLE_KEY) || "").trim() || DEFAULT_BRAND_TITLE;
    const tagline = String(localStorage.getItem(BRAND_TAGLINE_KEY) || "").trim() || DEFAULT_BRAND_TAGLINE;
    const logo = String(localStorage.getItem(BRAND_LOGO_KEY) || "").trim();
    return { title, tagline, logo };
  }

  function setBranding(branding) {
    localStorage.setItem(BRAND_TITLE_KEY, String(branding.title || DEFAULT_BRAND_TITLE).trim() || DEFAULT_BRAND_TITLE);
    localStorage.setItem(BRAND_TAGLINE_KEY, String(branding.tagline || DEFAULT_BRAND_TAGLINE).trim() || DEFAULT_BRAND_TAGLINE);
    if (branding.logo) {
      localStorage.setItem(BRAND_LOGO_KEY, String(branding.logo));
    } else {
      localStorage.removeItem(BRAND_LOGO_KEY);
    }
  }

  function loadSyncConfig() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SYNC_CONFIG_KEY) || "{}");
      return {
        url: String(parsed.url || "").trim(),
        anonKey: String(parsed.anonKey || "").trim(),
        userId: String(parsed.userId || "").trim(),
        auto: Boolean(parsed.auto)
      };
    } catch {
      return { url: "", anonKey: "", userId: "", auto: false };
    }
  }

  function saveSyncConfig(config) {
    const next = {
      url: String(config?.url || "").trim().replace(/\/+$/, ""),
      anonKey: String(config?.anonKey || "").trim(),
      userId: String(config?.userId || "").trim(),
      auto: Boolean(config?.auto)
    };
    localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(next));
    return next;
  }

  function isSyncConfigured(config) {
    const cfg = config || loadSyncConfig();
    return Boolean(cfg.url && cfg.anonKey && cfg.userId);
  }

  function syncStatus(message) {
    const el = q("#syncStatusText");
    if (el) el.textContent = message;
  }

  async function pushCloudSync() {
    const cfg = loadSyncConfig();
    if (!isSyncConfigured(cfg)) return false;

    const payload = {
      items: S.loadItems(),
      meta: S.loadMeta(),
      branding: getBranding(),
      updatedAt: new Date().toISOString()
    };

    const resp = await fetch(`${cfg.url}/rest/v1/manpharma_sync?on_conflict=user_id`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: cfg.anonKey,
        Authorization: `Bearer ${cfg.anonKey}`,
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify([{ user_id: cfg.userId, payload }])
    });
    if (!resp.ok) throw new Error("Cloud push failed");
    return true;
  }

  async function pullCloudSync() {
    const cfg = loadSyncConfig();
    if (!isSyncConfigured(cfg)) return false;

    const resp = await fetch(`${cfg.url}/rest/v1/manpharma_sync?user_id=eq.${encodeURIComponent(cfg.userId)}&select=payload&limit=1`, {
      headers: {
        apikey: cfg.anonKey,
        Authorization: `Bearer ${cfg.anonKey}`
      }
    });
    if (!resp.ok) throw new Error("Cloud pull failed");

    const rows = await resp.json();
    const remotePayload = rows?.[0]?.payload;
    if (!remotePayload || typeof remotePayload !== "object") return true;

    const remoteItems = Array.isArray(remotePayload.items) ? remotePayload.items : [];
    const localItems = S.loadItems();
    const byId = new Map();
    localItems.forEach((item) => byId.set(item.id, item));
    remoteItems.forEach((item) => {
      if (item && item.id) byId.set(item.id, item);
    });
    S.saveItems(Array.from(byId.values()));

    const localMeta = S.loadMeta();
    const remoteMeta = remotePayload.meta && typeof remotePayload.meta === "object" ? remotePayload.meta : {};
    S.saveMeta({
      ...localMeta,
      ...remoteMeta,
      ideaCategories: [...(localMeta.ideaCategories || []), ...((remoteMeta.ideaCategories) || [])],
      taskCategories: [...(localMeta.taskCategories || []), ...((remoteMeta.taskCategories) || [])]
    });

    if (remotePayload.branding && typeof remotePayload.branding === "object") {
      const currentBranding = getBranding();
      setBranding({
        title: String(remotePayload.branding.title || currentBranding.title || DEFAULT_BRAND_TITLE),
        tagline: String(remotePayload.branding.tagline || currentBranding.tagline || DEFAULT_BRAND_TAGLINE),
        logo: String(remotePayload.branding.logo || currentBranding.logo || "")
      });
      applyBranding(getBranding());
    }

    return true;
  }

  let syncTimer = null;
  function queueCloudSync() {
    if (!isSyncConfigured(loadSyncConfig())) return;
    if (syncTimer) window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(async () => {
      try {
        await pushCloudSync();
        syncStatus("Cloud synced.");
      } catch {
        syncStatus("Cloud sync failed. Check settings/network.");
      }
    }, 800);
  }

  function applyBrandingToHeader(branding) {
    const titleEl = q("#brandTitle");
    const taglineEl = q("#brandTagline");
    const logoEl = q("#brandLogo");
    const fallbackEl = q("#brandLogoFallback");

    if (titleEl) titleEl.textContent = branding.title || DEFAULT_BRAND_TITLE;
    if (taglineEl) taglineEl.textContent = branding.tagline || DEFAULT_BRAND_TAGLINE;

    if (logoEl && fallbackEl) {
      if (branding.logo) {
        logoEl.src = branding.logo;
        logoEl.classList.remove("hidden");
        fallbackEl.classList.add("hidden");
      } else {
        logoEl.removeAttribute("src");
        logoEl.classList.add("hidden");
        fallbackEl.classList.remove("hidden");
      }
    }
  }

  function applyBrandingToForm(branding) {
    const titleInput = q("#brandingTitleInput");
    const taglineInput = q("#brandingTaglineInput");
    const preview = q("#brandingLogoPreview");
    const previewFallback = q("#brandingLogoPreviewFallback");

    if (titleInput) titleInput.value = branding.title || DEFAULT_BRAND_TITLE;
    if (taglineInput) taglineInput.value = branding.tagline || DEFAULT_BRAND_TAGLINE;

    if (preview && previewFallback) {
      if (branding.logo) {
        preview.src = branding.logo;
        preview.classList.remove("hidden");
        previewFallback.classList.add("hidden");
      } else {
        preview.removeAttribute("src");
        preview.classList.add("hidden");
        previewFallback.classList.remove("hidden");
      }
    }

    const cfg = loadSyncConfig();
    if (q("#syncUrlInput")) q("#syncUrlInput").value = cfg.url;
    if (q("#syncAnonKeyInput")) q("#syncAnonKeyInput").value = cfg.anonKey;
    if (q("#syncUserIdInput")) q("#syncUserIdInput").value = cfg.userId;
    if (q("#syncAutoToggle")) q("#syncAutoToggle").checked = cfg.auto;
    syncStatus(isSyncConfigured(cfg) ? "Cloud sync configured." : "Cloud sync not configured.");
  }

  function applyBranding(branding) {
    applyBrandingToHeader(branding);
    applyBrandingToForm(branding);
  }

  function readLogoAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read logo file"));
      reader.readAsDataURL(file);
    });
  }

  function closeModals() {
    q("#overlay")?.classList.add("hidden");
    qa(".modal").forEach((m) => m.classList.add("hidden"));
  }

  function isMobileChromeMode() {
    return window.matchMedia(MOBILE_CHROME_QUERY).matches;
  }

  function setFilterBarVisibility(show) {
    const bar = q(".filter-bar");
    if (!bar) return;
    chromeState.filterHidden = !show;
    bar.classList.toggle("hidden", !show);
  }

  function setCompactHeader(compact) {
    chromeState.compactHeader = compact;
    document.body.classList.toggle("top-chrome-compact", compact);
  }

  function setBottomNavVisibility(show) {
    chromeState.bottomNavHidden = !show;
    document.body.classList.toggle("bottom-nav-hidden", !show);
  }

  function resetMobileChrome() {
    chromeState.lastScrollTop = 0;
    setCompactHeader(false);
    setFilterBarVisibility(true);
    setBottomNavVisibility(true);
  }

  function activeScrollView() {
    return q(`main.content:not(.hidden)`);
  }

  function applyMobileChromeState(scrollTop, direction) {
    if (!isMobileChromeMode()) {
      resetMobileChrome();
      return;
    }

    if (scrollTop <= 12) {
      resetMobileChrome();
      return;
    }

    if (direction === "down") {
      if (scrollTop > COMPACT_HEADER_TRIGGER) setCompactHeader(true);
      if (scrollTop > FILTER_HIDE_TRIGGER) setFilterBarVisibility(false);
      if (scrollTop > NAV_HIDE_TRIGGER) setBottomNavVisibility(false);
      return;
    }

    if (direction === "up") {
      setCompactHeader(scrollTop > COMPACT_HEADER_TRIGGER);
      setFilterBarVisibility(true);
      setBottomNavVisibility(true);
    }
  }

  function handleContentScroll(event) {
    const scroller = event.currentTarget;
    if (!scroller || !isMobileChromeMode()) return;
    const current = Math.max(0, Number(scroller.scrollTop || 0));
    const delta = current - chromeState.lastScrollTop;

    if (Math.abs(delta) < SCROLL_DELTA_THRESHOLD) return;

    const direction = delta > 0 ? "down" : "up";

    if (chromeState.ticking) return;
    chromeState.ticking = true;
    window.requestAnimationFrame(() => {
      applyMobileChromeState(current, direction);
      chromeState.lastScrollTop = current;
      chromeState.ticking = false;
    });
  }

  function bindMobileChromeBehavior() {
    qa(".main-content").forEach((panel) => {
      panel.addEventListener("scroll", handleContentScroll, { passive: true });
    });

    window.matchMedia(MOBILE_CHROME_QUERY).addEventListener("change", () => {
      resetMobileChrome();
    });
  }

  function updateAppHeight() {
    const height = window.visualViewport?.height || window.innerHeight;
    document.documentElement.style.setProperty("--app-height", `${Math.round(height)}px`);
  }

  function syncChromeForView(viewId) {
    chromeState.activeViewId = viewId;
    const view = q(`#${viewId}`);
    const scrollTop = Number(view?.scrollTop || 0);
    chromeState.lastScrollTop = scrollTop;

    if (!isMobileChromeMode()) {
      resetMobileChrome();
      return;
    }

    if (scrollTop <= 12) {
      resetMobileChrome();
      return;
    }

    setCompactHeader(scrollTop > COMPACT_HEADER_TRIGGER);
    setFilterBarVisibility(scrollTop <= FILTER_HIDE_TRIGGER);
    setBottomNavVisibility(scrollTop <= NAV_HIDE_TRIGGER);
  }

  function openModal(id) {
    q("#overlay")?.classList.remove("hidden");
    q(`#${id}`)?.classList.remove("hidden");
  }

  function selectedValue(groupName) {
    return q(`[data-chip-group="${groupName}"] .chip.active`)?.dataset.value || "";
  }

  function setActiveChip(groupName, value) {
    const chips = qa(`[data-chip-group="${groupName}"] .chip`);
    if (!chips.length) return;
    chips.forEach((c) => c.classList.remove("active"));
    const normalized = String(value || "").toLowerCase();
    const target = chips.find((c) => c.dataset.value === normalized) || chips[0];
    if (target) target.classList.add("active");
  }

  function currentEditItem(form) {
    const id = String(form?.elements?.editId?.value || "");
    return id ? S.getById(id) : null;
  }

  async function collectAttachments(form) {
    const existing = currentEditItem(form);
    const currentAttachments = Array.isArray(existing?.meta?.attachments) ? existing.meta.attachments : [];
    const input = form.querySelector('input[name="attachment"]');
    const newAttachments = await S.saveAttachmentsFromInput(input);
    return [...currentAttachments, ...newAttachments];
  }

  function resetModalState(modalId) {
    const title = modalTitles[modalId];
    if (title) {
      const head = q(`#${modalId} h2`);
      if (head) head.textContent = title;
    }

    const form = q(`#${modalId} form`);
    if (form && modalId !== "brandingModal") {
      form.reset();
      if (form.elements.editId) form.elements.editId.value = "";
    }

    if (modalId === "taskModal") {
      const firstTaskCat = S.loadMeta().taskCategories?.[0] || "general";
      setActiveChip("taskPriority", "medium");
      setActiveChip("taskCategory", firstTaskCat);
    }
    if (modalId === "ideaModal") {
      setActiveChip("ideaPriority", "medium");
    }
    if (modalId === "postModal") {
      setActiveChip("postType", "video");
      setActiveChip("postStatus", "scheduled");
      setActiveChip("platform", "youtube");
      setActiveChip("postPriority", "medium");
    }
    if (modalId === "videoModal") {
      setActiveChip("videoStatus", "in-progress");
      setActiveChip("videoPriority", "medium");
    }
    if (modalId === "revenueModal") {
      if (form?.elements?.paymentStatus) form.elements.paymentStatus.value = "received";
      if (form?.elements?.source) form.elements.source.value = "YouTube";
    }
    if (modalId === "brandingModal") {
      applyBrandingToForm(getBranding());
    }
  }

  function moduleFromItem(item) {
    return item.module || item.type;
  }

  function prefillEdit(item) {
    const module = moduleFromItem(item);
    const cfg = moduleToModal[module];
    if (!cfg) return;

    const modalH2 = q(`#${cfg.modalId} h2`);
    if (modalH2) modalH2.textContent = `Edit ${module.charAt(0).toUpperCase() + module.slice(1)}`;

    const form = q(`#${cfg.formId}`);
    if (!form) return;
    if (form.elements.editId) form.elements.editId.value = item.id;

    if (module === "task") {
      form.elements.title.value = item.title || "";
      form.elements.desc.value = item.description || "";
      form.elements.dueDate.value = item.dueDate || "";
      setActiveChip("taskPriority", item.priority || "medium");
      setActiveChip("taskCategory", item.category || "content");
    }

    if (module === "idea") {
      form.elements.title.value = item.title || "";
      form.elements.description.value = item.description || "";
      if (form.elements.ideaDate) form.elements.ideaDate.value = item.dueDate ? String(item.dueDate).slice(0, 10) : "";
      S.addIdeaCategory(item.category || "pharmacology");
      UI.renderIdeaCategories();
      setActiveChip("ideaCategory", item.category || "pharmacology");
      setActiveChip("ideaPriority", item.priority || "medium");
    }

    if (module === "post") {
      form.elements.title.value = item.title || "";
      form.elements.date.value = item.dueDate || "";
      setActiveChip("postType", item.category || "post");
      setActiveChip("postStatus", item.meta?.status || "scheduled");
      setActiveChip("platform", item.meta?.platform || "youtube");
      setActiveChip("postPriority", item.priority || "medium");
    }

    if (module === "video") {
      form.elements.title.value = item.title || "";
      setActiveChip("videoStatus", item.meta?.status || "in-progress");
      setActiveChip("videoPriority", item.priority || "medium");
    }

    if (module === "revenue") {
      form.elements.amount.value = Number(item.meta?.amount || 0);
      form.elements.source.value = item.meta?.source || "";
      if (form.elements.title) form.elements.title.value = item.title || "";
      if (form.elements.notes) form.elements.notes.value = item.description || "";
      if (form.elements.category) form.elements.category.value = item.category || "";
      if (form.elements.date) form.elements.date.value = item.dueDate ? String(item.dueDate).slice(0, 10) : "";
      if (form.elements.paymentStatus) form.elements.paymentStatus.value = item.meta?.paymentStatus || "received";
    }

    openModal(cfg.modalId);
  }

  async function saveTask(form) {
    const fd = new FormData(form);
    const attachments = await collectAttachments(form);
    S.upsertItem({
      id: String(fd.get("editId") || "") || undefined,
      type: "task",
      module: "task",
      title: String(fd.get("title") || ""),
      description: String(fd.get("desc") || ""),
      category: selectedValue("taskCategory") || "content",
      priority: selectedValue("taskPriority") || "medium",
      dueDate: String(fd.get("dueDate") || ""),
      meta: {
        attachments
      }
    });
  }

  async function saveIdea(form) {
    const fd = new FormData(form);
    const attachments = await collectAttachments(form);
    S.upsertItem({
      id: String(fd.get("editId") || "") || undefined,
      type: "idea",
      module: "idea",
      title: String(fd.get("title") || ""),
      description: String(fd.get("description") || ""),
      category: selectedValue("ideaCategory") || "pharmacology",
      priority: selectedValue("ideaPriority") || "medium",
      dueDate: String(fd.get("ideaDate") || ""),
      meta: { attachments }
    });
  }

  async function savePost(form) {
    const fd = new FormData(form);
    const attachments = await collectAttachments(form);
    S.upsertItem({
      id: String(fd.get("editId") || "") || undefined,
      type: "content",
      module: "post",
      title: String(fd.get("title") || ""),
      description: "",
      category: selectedValue("postType") || "post",
      priority: selectedValue("postPriority") || "medium",
      dueDate: String(fd.get("date") || ""),
      meta: {
        status: selectedValue("postStatus") || "scheduled",
        platform: selectedValue("platform") || "youtube",
        attachments
      }
    });
  }

  async function saveVideo(form) {
    const fd = new FormData(form);
    const attachments = await collectAttachments(form);
    S.upsertItem({
      id: String(fd.get("editId") || "") || undefined,
      type: "content",
      module: "video",
      title: String(fd.get("title") || ""),
      description: "",
      category: "video",
      priority: selectedValue("videoPriority") || "medium",
      dueDate: "",
      meta: {
        status: selectedValue("videoStatus") || "in-progress",
        attachments
      }
    });
  }

  async function saveRevenue(form) {
    const fd = new FormData(form);
    const amount = Number(fd.get("amount") || 0);
    S.upsertItem({
      id: String(fd.get("editId") || "") || undefined,
      type: "revenue",
      module: "revenue",
      title: String(fd.get("title") || fd.get("source") || "Revenue"),
      description: String(fd.get("notes") || ""),
      category: String(fd.get("category") || "income"),
      priority: "low",
      dueDate: String(fd.get("date") || ""),
      meta: {
        amount,
        source: String(fd.get("source") || ""),
        paymentStatus: String(fd.get("paymentStatus") || "received")
      }
    });
  }

  function saveBranding(form) {
    const fd = new FormData(form);
    const current = getBranding();
    const next = {
      title: String(fd.get("brandTitle") || "").trim() || DEFAULT_BRAND_TITLE,
      tagline: String(fd.get("brandTagline") || "").trim() || DEFAULT_BRAND_TAGLINE,
      logo: current.logo || ""
    };
    setBranding(next);
    applyBranding(next);
    saveSyncConfig({
      url: String(fd.get("syncUrl") || ""),
      anonKey: String(fd.get("syncAnonKey") || ""),
      userId: String(fd.get("syncUserId") || ""),
      auto: Boolean(q("#syncAutoToggle")?.checked)
    });
  }

  function downloadBackup() {
    const payload = {
      exportedAt: new Date().toISOString(),
      version: 1,
      items: S.loadItems(),
      meta: S.loadMeta(),
      branding: getBranding()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `manpharma-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importBackupFile(file) {
    if (!file) return;
    if (!/\.json$/i.test(file.name || "")) {
      alert("Please choose a valid JSON backup file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        if (!parsed || typeof parsed !== "object") {
          alert("Invalid backup file.");
          return;
        }
        const items = Array.isArray(parsed.items) ? parsed.items : [];
        const meta = parsed.meta && typeof parsed.meta === "object" ? parsed.meta : {};
        const branding = parsed.branding && typeof parsed.branding === "object" ? parsed.branding : {};

        const existingItems = S.loadItems();
        const mergedById = new Map();
        existingItems.forEach((item) => mergedById.set(item.id, item));
        items.forEach((item) => {
          if (item && item.id) {
            const prev = mergedById.get(item.id) || {};
            mergedById.set(item.id, { ...prev, ...item });
          }
        });
        S.saveItems(Array.from(mergedById.values()));

        const currentMeta = S.loadMeta();
        S.saveMeta({
          ...currentMeta,
          ...meta,
          ideaCategories: [...(currentMeta.ideaCategories || []), ...((meta.ideaCategories) || [])]
        });

        const currentBranding = getBranding();
        setBranding({
          title: String(branding.title || currentBranding.title || DEFAULT_BRAND_TITLE),
          tagline: String(branding.tagline || currentBranding.tagline || DEFAULT_BRAND_TAGLINE),
          logo: String(branding.logo || currentBranding.logo || "")
        });
        applyBranding(getBranding());
        UI.render();
        alert("Backup imported successfully.");
      } catch {
        alert("Invalid backup file.");
      }
    };
    reader.readAsText(file);
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").then((reg) => {
        reg.update().catch(() => {});
        setInterval(() => reg.update().catch(() => {}), 60 * 1000);

        if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              worker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      }).catch(() => {});

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (sessionStorage.getItem("manpharma_sw_reloaded")) return;
        sessionStorage.setItem("manpharma_sw_reloaded", "1");
        window.location.reload();
      });
    });
  }

  function bindEvents() {
    q("#overlay")?.addEventListener("click", closeModals);
    qa("[data-close]").forEach((btn) => btn.addEventListener("click", closeModals));

    qa(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.view;
        qa("main.content").forEach((v) => v.classList.add("hidden"));
        q(`#${id}`)?.classList.remove("hidden");
        qa(".nav-btn").forEach((n) => n.classList.toggle("active", n === btn));
        syncChromeForView(id);
      });
    });

    document.addEventListener("click", function (e) {
      const openBtn = e.target.closest("[data-open]");
      if (openBtn) {
        const modalId = openBtn.dataset.open;
        if (modalId && modalId !== "quickAddModal") {
          q("#quickAddModal")?.classList.add("hidden");
        }
        resetModalState(modalId);
        openModal(modalId);
      }

      const chip = e.target.closest(".chip");
      if (chip) {
        const group = chip.closest("[data-chip-group]");
        if (group) {
          qa(`[data-chip-group="${group.dataset.chipGroup}"] .chip`).forEach((c) => c.classList.remove("active"));
          chip.classList.add("active");
        }
      }

      const editBtn = e.target.closest('[data-action="edit"]');
      if (editBtn && !editBtn.disabled) {
        const item = S.getById(editBtn.dataset.id);
        if (item) prefillEdit(item);
      }

      const rescheduleBtn = e.target.closest('[data-action="reschedule"]');
      if (rescheduleBtn) {
        const task = S.getById(rescheduleBtn.dataset.id);
        if (!task || task.module !== "task") return;
        if (q("#rescheduleForm")?.elements?.taskId) q("#rescheduleForm").elements.taskId.value = task.id;
        if (q("#rescheduleForm")?.elements?.dueDate) q("#rescheduleForm").elements.dueDate.value = task.dueDate || "";
        openModal("rescheduleModal");
      }

      const deleteBtn = e.target.closest('[data-action="delete"]');
      if (deleteBtn) {
        if (confirm("Delete this item permanently?")) {
          S.deleteItem(deleteBtn.dataset.id);
          UI.render();
          queueCloudSync();
        }
      }

      const previewBtn = e.target.closest('[data-action="preview-attachment"]');
      if (previewBtn) {
        const fileId = previewBtn.dataset.fileId;
        if (!fileId) return;
        S.loadAttachment(fileId).then((file) => {
          const box = q("#filePreviewContent");
          if (!box) return;
          if (!file || !file.payload) {
            box.innerHTML = "<p class=\"meta-line\">Attachment not available.</p>";
            openModal("filePreviewModal");
            return;
          }
          if (String(file.type || "").startsWith("image/")) {
            box.innerHTML = `<img src="${file.payload}" alt="Attachment preview" />`;
          } else if (String(file.type || "").includes("pdf")) {
            box.innerHTML = `<iframe src="${file.payload}" title="PDF preview"></iframe>`;
          } else {
            box.innerHTML = `<p class="meta-line">Preview not supported for this type.</p><a href="${file.payload}" download="${file.name || "attachment"}">Download ${file.name || "file"}</a>`;
          }
          openModal("filePreviewModal");
        });
      }

      const removeCat = e.target.closest('[data-action="remove-category"]');
      if (removeCat) {
        if (confirm("Delete this custom category?")) {
          S.removeIdeaCategory(removeCat.dataset.value);
          UI.render();
          queueCloudSync();
        }
      }

      const deleteTaskCat = e.target.closest('[data-action="delete-task-category"]');
      if (deleteTaskCat) {
        const current = String(deleteTaskCat.dataset.value || "");
        if (!confirm("Delete this category? Existing tasks will move to General.")) return;
        S.addTaskCategory("general");
        const result = S.removeTaskCategory(current, "general");
        if (result && result.ok) {
          UI.render();
          queueCloudSync();
        }
      }

      if (e.target.closest("#notifyButton")) {
        if (!window.isSecureContext) {
          alert("Browser notifications need HTTPS or localhost. Home-screen alerts panel still works in this mode.");
        } else {
          requestNotificationPermissionFromUserAction();
        }
        if (
          "Notification" in window &&
          Notification.permission !== "granted" &&
          !localStorage.getItem(NOTIFICATION_HINT_KEY)
        ) {
          localStorage.setItem(NOTIFICATION_HINT_KEY, "1");
          alert("Notifications need permission. iPhone me app Home Screen se open karke permission allow karein.");
        }
        const dueList = q("#bellDueList");
        const dueTasks = UI.getDueAndOverdueTasks ? UI.getDueAndOverdueTasks() : [];
        if (dueList) {
          dueList.innerHTML = dueTasks.length
            ? dueTasks.map((t) => `<article class="list-item"><p class="item-title">${t.title}</p><p class="meta-line">Due: ${UI.formatDate(t.dueDate)}</p></article>`).join("")
            : `<p class="meta-line">No due or overdue tasks.</p>`;
        }
        openModal("bellModal");
      }

      if (e.target.closest("#replaceLogoBtn")) {
        q("#logoInput")?.click();
      }

      const addForDate = e.target.closest('[data-action="add-for-date"]');
      if (addForDate) {
        const dateKey = String(addForDate.dataset.date || "");
        const map = {
          task: { modal: "taskModal", selector: "input[name='dueDate']", value: `${dateKey}T09:00` },
          idea: { modal: "ideaModal", selector: "input[name='ideaDate']", value: dateKey },
          post: { modal: "postModal", selector: "input[name='date']", value: `${dateKey}T09:00` },
          revenue: { modal: "revenueModal", selector: "input[name='date']", value: dateKey }
        };
        const cfg = map[String(addForDate.dataset.kind || "task").toLowerCase()];
        if (!cfg) return;
        resetModalState(cfg.modal);
        openModal(cfg.modal);
        const input = q(`#${cfg.modal} ${cfg.selector}`);
        if (input) input.value = cfg.value;
      }
    });

    document.addEventListener("change", function (e) {
      const toggle = e.target.closest('[data-action="toggle"]');
      if (toggle) {
        S.toggleComplete(toggle.dataset.id, toggle.checked);
        UI.render();
        queueCloudSync();
      }
    });

    q("#taskForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await saveTask(e.currentTarget);
      closeModals();
      UI.render();
      queueCloudSync();
    });

    q("#ideaForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await saveIdea(e.currentTarget);
      closeModals();
      UI.render();
      queueCloudSync();
    });

    q("#postForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await savePost(e.currentTarget);
      closeModals();
      UI.render();
      queueCloudSync();
    });

    q("#videoForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await saveVideo(e.currentTarget);
      closeModals();
      UI.render();
      queueCloudSync();
    });

    q("#revenueForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await saveRevenue(e.currentTarget);
      closeModals();
      UI.render();
      queueCloudSync();
    });

    q("#rescheduleForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const taskId = String(form.elements.taskId?.value || "");
      const nextDue = String(form.elements.dueDate?.value || "");
      const task = S.getById(taskId);
      if (!task || task.module !== "task" || !nextDue) return;
      S.upsertItem({
        ...task,
        dueDate: nextDue,
        rescheduleCount: Number(task.rescheduleCount || 0) + 1,
        meta: {
          ...(task.meta || {}),
          rescheduledAt: new Date().toISOString()
        }
      });
      closeModals();
      UI.render();
      queueCloudSync();
    });

    q("#brandingForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      saveBranding(e.currentTarget);
      closeModals();
      queueCloudSync();
    });

    q("#logoInput")?.addEventListener("change", async (e) => {
      const input = e.currentTarget;
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        const base64 = await readLogoAsBase64(file);
        const branding = getBranding();
        const next = { ...branding, logo: base64 };
        setBranding(next);
        applyBranding(next);
        queueCloudSync();
      } catch {
        alert("Logo upload failed. Please try another image.");
      }
      input.value = "";
    });

    q("#removeLogoBtn")?.addEventListener("click", () => {
      const branding = getBranding();
      const next = { ...branding, logo: "" };
      setBranding(next);
      applyBranding(next);
      queueCloudSync();
    });

    q("#exportDataBtn")?.addEventListener("click", downloadBackup);

    q("#importDataBtn")?.addEventListener("click", () => {
      q("#importDataInput")?.click();
    });

    q("#importDataInput")?.addEventListener("change", (e) => {
      const input = e.currentTarget;
      const file = input.files && input.files[0];
      if (file) importBackupFile(file);
      input.value = "";
      queueCloudSync();
    });

    q("#addIdeaCategoryBtn")?.addEventListener("click", () => {
      const input = q("#newIdeaCategoryInput");
      if (!input) return;
      const value = String(input.value || "").trim();
      if (!value) return;
      S.addIdeaCategory(value);
      input.value = "";
      UI.render();
      UI.renderIdeaCategories();
      setActiveChip("ideaCategory", S.normalizeCategory(value));
      queueCloudSync();
    });

    q("#newIdeaCategoryInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        q("#addIdeaCategoryBtn")?.click();
      }
    });

    q("#addTaskCategoryBtn")?.addEventListener("click", () => {
      const input = q("#newTaskCategoryInput");
      if (!input) return;
      const value = String(input.value || "").trim();
      if (!value) return;
      S.addTaskCategory(value);
      input.value = "";
      UI.render();
      UI.renderTaskCategories();
      setActiveChip("taskCategory", S.normalizeCategory(value));
      queueCloudSync();
    });

    q("#syncNowBtn")?.addEventListener("click", async () => {
      try {
        syncStatus("Syncing...");
        await pushCloudSync();
        syncStatus("Cloud synced.");
      } catch {
        syncStatus("Cloud sync failed. Check settings/network.");
      }
    });

    q("#pullNowBtn")?.addEventListener("click", async () => {
      try {
        syncStatus("Pulling cloud data...");
        await pullCloudSync();
        UI.render();
        syncStatus("Cloud data pulled.");
      } catch {
        syncStatus("Cloud pull failed. Check settings/network.");
      }
    });

    q("#newTaskCategoryInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        q("#addTaskCategoryBtn")?.click();
      }
    });

    function syncSearch() {
      UI.setSearchTerm(String(q("#globalSearchInput")?.value || "").trim());
      UI.render();
    }

    q("#globalSearchInput")?.addEventListener("input", syncSearch);

    q("#dashboardDatePicker")?.addEventListener("change", (e) => {
      UI.setDashboardDate(String(e.target.value || ""));
      UI.render();
    });

    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".range-btn");
      if (!btn) return;
      const group = btn.closest("[data-range-group]");
      if (!group) return;
      Array.from(group.querySelectorAll(".range-btn")).forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      UI.render();
    });

    window.addEventListener("online", () => {
      const cfg = loadSyncConfig();
      if (cfg.auto && isSyncConfigured(cfg)) {
        pushCloudSync().then(() => syncStatus("Cloud synced.")).catch(() => syncStatus("Cloud sync failed."));
      }
    });

    let touchStartX = 0;
    let touchTarget = null;

    document.addEventListener("touchstart", (e) => {
      const card = e.target.closest(".list-item");
      if (!card) return;
      touchStartX = e.changedTouches?.[0]?.clientX || 0;
      touchTarget = card;
    }, { passive: true });

    document.addEventListener("touchend", (e) => {
      if (!touchTarget) return;
      const endX = e.changedTouches?.[0]?.clientX || 0;
      const delta = endX - touchStartX;
      const card = touchTarget;
      touchTarget = null;
      if (Math.abs(delta) < 70) return;

      const itemId = card.querySelector("[data-action='toggle']")?.dataset.id
        || card.querySelector("[data-action='edit']")?.dataset.id
        || card.querySelector("[data-action='delete']")?.dataset.id;
      if (!itemId) return;

      if (delta > 0) {
        card.classList.add("swipe-hint-right");
        setTimeout(() => card.classList.remove("swipe-hint-right"), 240);
        S.toggleComplete(itemId, true);
        UI.render();
        queueCloudSync();
      } else {
        card.classList.add("swipe-hint-left");
        setTimeout(() => card.classList.remove("swipe-hint-left"), 240);
        if (confirm("Delete this item?")) {
          S.deleteItem(itemId);
          UI.render();
          queueCloudSync();
        }
      }
    }, { passive: true });
  }

  function init() {
    S.migrateLegacyIfNeeded();
    updateAppHeight();
    window.addEventListener("resize", updateAppHeight);
    window.visualViewport?.addEventListener("resize", updateAppHeight);
    window.visualViewport?.addEventListener("scroll", updateAppHeight);
    applyBranding(getBranding());
    const today = localDateKey(new Date());
    if (q("#dashboardDatePicker")) {
      q("#dashboardDatePicker").value = today;
    }
    UI.setDashboardDate(today);
    bindEvents();
    bindMobileChromeBehavior();
    syncChromeForView("dashboardView");
    UI.render();
    const cfg = loadSyncConfig();
    if (isSyncConfigured(cfg)) {
      syncStatus("Cloud sync configured.");
      if (cfg.auto && navigator.onLine) {
        pullCloudSync().then(() => {
          UI.render();
          return pushCloudSync();
        }).then(() => {
          syncStatus("Cloud synced.");
        }).catch(() => {
          syncStatus("Cloud sync failed. Check settings/network.");
        });
      }
    }
    startNotificationChecks();
    registerServiceWorker();
  }

  init();
})();
