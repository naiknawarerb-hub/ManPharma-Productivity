(function () {
  const S = window.ManPharmaStorage;
  const UI = window.ManPharmaUI;
  const BRAND_TITLE_KEY = "manpharma_brand_title";
  const BRAND_TAGLINE_KEY = "manpharma_brand_tagline";
  const BRAND_LOGO_KEY = "manpharma_logo";
  const LAST_NOTIFICATION_KEY = "manpharma_last_notification";
  const NOTIFICATION_HINT_KEY = "manpharma_notification_hint_seen";
  const DEFAULT_BRAND_TITLE = "ManPharma Tutorials";
  const DEFAULT_BRAND_TAGLINE = "In the process of building a 1000 crore EdTech brand";

  function q(sel) { return document.querySelector(sel); }
  function qa(sel) { return Array.from(document.querySelectorAll(sel)); }

  function isDueSoon(dateStr, days = 2) {
    if (!dateStr) return false;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const due = dateStr.includes("T") ? new Date(dateStr) : new Date(dateStr + "T00:00:00");
    if (Number.isNaN(due.getTime())) return false;
    due.setHours(0, 0, 0, 0);
    const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    return diff <= days;
  }

  function formatDate(raw) {
    if (!raw) return "-";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function dueNotifications(items) {
    const alerts = [];

    items.filter((i) => i.module === "task" && !i.completed).forEach((task) => {
      if (isDueSoon(task.dueDate, 2)) alerts.push(`Task due: ${task.title} (${formatDate(task.dueDate)})`);
    });

    items.filter((i) => i.module === "post" && !i.completed).forEach((post) => {
      if (isDueSoon(post.dueDate, 2)) alerts.push(`Post scheduled: ${post.title} (${formatDate(post.dueDate)})`);
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

    const alerts = dueNotifications(S.loadItems());
    if (!alerts.length) return;

    const body = alerts.slice(0, 3).join(" | ");
    if (localStorage.getItem(LAST_NOTIFICATION_KEY) === body) return;
    localStorage.setItem(LAST_NOTIFICATION_KEY, body);

    try {
      new Notification("ManPharma Due Alerts", { body });
    } catch (_) {}
  }

  function startNotificationChecks() {
    pushDueBrowserNotification();
    setInterval(() => {
      if (document.visibilityState === "visible") {
        pushDueBrowserNotification();
      }
    }, 60 * 1000);
  }

  const modalTitles = {
    taskModal: "New Task",
    ideaModal: "New Idea",
    noteModal: "New Study Note",
    postModal: "Schedule Post",
    videoModal: "New Video",
    revenueModal: "Add Revenue"
  };

  const moduleToModal = {
    task: { modalId: "taskModal", formId: "taskForm" },
    idea: { modalId: "ideaModal", formId: "ideaForm" },
    note: { modalId: "noteModal", formId: "noteForm" },
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
      setActiveChip("taskPriority", "medium");
      setActiveChip("taskCategory", "content");
    }
    if (modalId === "ideaModal") {
      setActiveChip("ideaPriority", "medium");
    }
    if (modalId === "noteModal") {
      setActiveChip("notePriority", "medium");
      if (q("#progressLabel")) q("#progressLabel").textContent = "0";
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
      S.addIdeaCategory(item.category || "pharmacology");
      UI.renderIdeaCategories();
      setActiveChip("ideaCategory", item.category || "pharmacology");
      setActiveChip("ideaPriority", item.priority || "medium");
    }

    if (module === "note") {
      form.elements.title.value = item.title || "";
      form.elements.subject.value = item.category || "";
      form.elements.content.value = item.description || "";
      form.elements.progress.value = Number(item.meta?.progress || 0);
      if (q("#progressLabel")) q("#progressLabel").textContent = String(Number(item.meta?.progress || 0));
      setActiveChip("notePriority", item.priority || "medium");
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
    }

    openModal(cfg.modalId);
  }

  function saveTask(form) {
    const fd = new FormData(form);
    S.upsertItem({
      id: String(fd.get("editId") || "") || undefined,
      type: "task",
      module: "task",
      title: String(fd.get("title") || ""),
      description: String(fd.get("desc") || ""),
      category: selectedValue("taskCategory") || "content",
      priority: selectedValue("taskPriority") || "medium",
      dueDate: String(fd.get("dueDate") || ""),
      meta: {}
    });
  }

  function saveIdea(form) {
    const fd = new FormData(form);
    S.upsertItem({
      id: String(fd.get("editId") || "") || undefined,
      type: "idea",
      module: "idea",
      title: String(fd.get("title") || ""),
      description: String(fd.get("description") || ""),
      category: selectedValue("ideaCategory") || "pharmacology",
      priority: selectedValue("ideaPriority") || "medium",
      dueDate: "",
      meta: {}
    });
  }

  function saveNote(form) {
    const fd = new FormData(form);
    S.upsertItem({
      id: String(fd.get("editId") || "") || undefined,
      type: "note",
      module: "note",
      title: String(fd.get("title") || ""),
      description: String(fd.get("content") || ""),
      category: String(fd.get("subject") || ""),
      priority: selectedValue("notePriority") || "medium",
      dueDate: "",
      meta: { progress: Number(fd.get("progress") || 0) }
    });
  }

  function savePost(form) {
    const fd = new FormData(form);
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
        platform: selectedValue("platform") || "youtube"
      }
    });
  }

  function saveVideo(form) {
    const fd = new FormData(form);
    S.upsertItem({
      id: String(fd.get("editId") || "") || undefined,
      type: "content",
      module: "video",
      title: String(fd.get("title") || ""),
      description: "",
      category: "video",
      priority: selectedValue("videoPriority") || "medium",
      dueDate: "",
      meta: { status: selectedValue("videoStatus") || "in-progress" }
    });
  }

  function saveRevenue(form) {
    const fd = new FormData(form);
    const amount = Number(fd.get("amount") || 0);
    S.upsertItem({
      id: String(fd.get("editId") || "") || undefined,
      type: "revenue",
      module: "revenue",
      title: String(fd.get("source") || "Revenue"),
      description: `₹${amount}`,
      category: "income",
      priority: "low",
      dueDate: "",
      meta: { amount, source: String(fd.get("source") || "") }
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
      });
    });

    document.addEventListener("click", function (e) {
      const openBtn = e.target.closest("[data-open]");
      if (openBtn) {
        const modalId = openBtn.dataset.open;
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

      const deleteBtn = e.target.closest('[data-action="delete"]');
      if (deleteBtn) {
        if (confirm("Delete this item permanently?")) {
          S.deleteItem(deleteBtn.dataset.id);
          UI.render();
        }
      }

      const removeCat = e.target.closest('[data-action="remove-category"]');
      if (removeCat) {
        if (confirm("Delete this custom category?")) {
          S.removeIdeaCategory(removeCat.dataset.value);
          UI.render();
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
        q("#notificationPanel")?.classList.toggle("hidden");
      }

      if (e.target.closest("#replaceLogoBtn")) {
        q("#logoInput")?.click();
      }
    });

    document.addEventListener("change", function (e) {
      const toggle = e.target.closest('[data-action="toggle"]');
      if (toggle) {
        S.toggleComplete(toggle.dataset.id, toggle.checked);
        UI.render();
      }
    });

    q("#taskForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      saveTask(e.currentTarget);
      closeModals();
      UI.render();
    });

    q("#ideaForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      saveIdea(e.currentTarget);
      closeModals();
      UI.render();
    });

    q("#noteForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      saveNote(e.currentTarget);
      closeModals();
      UI.render();
    });

    q("#postForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      savePost(e.currentTarget);
      closeModals();
      UI.render();
    });

    q("#videoForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      saveVideo(e.currentTarget);
      closeModals();
      UI.render();
    });

    q("#revenueForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      saveRevenue(e.currentTarget);
      closeModals();
      UI.render();
    });

    q("#brandingForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      saveBranding(e.currentTarget);
      closeModals();
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
    });

    q("#progress")?.addEventListener("input", (e) => {
      const label = q("#progressLabel");
      if (label) label.textContent = String(e.target.value || 0);
    });

    q("#addIdeaCategoryBtn")?.addEventListener("click", () => {
      const input = q("#newIdeaCategoryInput");
      if (!input) return;
      const value = String(input.value || "").trim();
      if (!value) return;
      S.addIdeaCategory(value);
      input.value = "";
      UI.render();
      setActiveChip("ideaCategory", S.normalizeCategory(value));
    });

    q("#newIdeaCategoryInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        q("#addIdeaCategoryBtn")?.click();
      }
    });
  }

  function init() {
    S.migrateLegacyIfNeeded();
    applyBranding(getBranding());
    bindEvents();
    UI.render();
    startNotificationChecks();
    registerServiceWorker();
  }

  init();
})();
