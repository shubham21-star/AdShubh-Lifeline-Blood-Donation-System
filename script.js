/* BloodAI – shared frontend behaviors (Bootstrap 5 + premium UX) */
(() => {
    "use strict";
  
    // ---------- Helpers ----------
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  
    const STORAGE_KEYS = {
      donors: "bloodai_donors_v1",
      requests: "bloodai_requests_v1",
    };
  
    function readJSON(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        return JSON.parse(raw);
      } catch {
        return fallback;
      }
    }
  
    function writeJSON(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  
    function normalize(s) {
      return String(s ?? "").trim().toLowerCase();
    }
  
    function bloodGroupLabel(bg) {
      // Keep canonical formatting used across UI.
      const v = String(bg ?? "").toUpperCase().replace(/\s+/g, "");
      return v;
    }
  
    function showToast(message, variant = "danger") {
      const host = $("#toastHost");
      if (!host) return;
  
      const el = document.createElement("div");
      el.className = "toast align-items-center text-bg-dark border-0";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      el.setAttribute("aria-atomic", "true");
  
      el.innerHTML = `
        <div class="d-flex">
          <div class="toast-body">
            <i class="fa-solid ${variant === "danger" ? "fa-circle-exclamation" : "fa-circle-check"} me-2 text-${variant}"></i>
            ${message}
          </div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
      `;
  
      host.appendChild(el);
      const toast = new bootstrap.Toast(el, { delay: 3200 });
      toast.show();
      el.addEventListener("hidden.bs.toast", () => el.remove(), { once: true });
    }
  
    // ---------- Navbar: active link + collapse on click ----------
    function initNavbar() {
      const nav = $(".navbar");
      const pathname = (location.pathname.split("/").pop() || "index.html").toLowerCase();
      $$(".navbar .nav-link").forEach((a) => {
        const href = (a.getAttribute("href") || "").toLowerCase();
        const isActive =
          (pathname === "" && href.includes("index.html")) ||
          (pathname === "index.html" && href.includes("index.html")) ||
          (pathname !== "index.html" && href.endsWith(pathname));
        if (isActive) a.classList.add("active");
      });
  
      // On mobile: close navbar after selecting a link.
      const navCollapse = $("#navbarNav");
      const toggler = $(".navbar-toggler");
      if (!navCollapse || !toggler) return;
  
      $$(".navbar .nav-link").forEach((link) => {
        link.addEventListener("click", () => {
          const isShown = navCollapse.classList.contains("show");
          if (isShown) toggler.click();
        });
      });
  
      // SaaS-like navbar shrink/elevation on scroll.
      if (nav) {
        const sync = () => {
          const scrolled = window.scrollY > 8;
          nav.classList.toggle("navbar-scrolled", scrolled);
        };
        sync();
        window.addEventListener("scroll", sync, { passive: true });
      }
    }
  
    // ---------- Scroll reveal ----------
    function initReveal() {
      const nodes = $$(".reveal");
      if (!nodes.length) return;
  
      // Stagger within each parent for premium motion.
      const seenParents = new WeakSet();
      nodes.forEach((n) => {
        const parent = n.parentElement;
        if (!parent || seenParents.has(parent)) return;
        const siblings = $$(".reveal", parent);
        siblings.forEach((el, idx) => {
          el.style.setProperty("--d", `${Math.min(idx * 70, 420)}ms`);
        });
        seenParents.add(parent);
      });
  
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add("reveal-in");
              io.unobserve(e.target);
            }
          });
        },
        { threshold: 0.12 }
      );
  
      nodes.forEach((n) => io.observe(n));
    }
  
    // ---------- Fancy button micro-interaction ----------
    function initButtons() {
      $$(".btn-premium").forEach((btn) => {
        btn.addEventListener("mousemove", (e) => {
          // Subtle dynamic highlight for premium feel.
          const r = btn.getBoundingClientRect();
          const x = ((e.clientX - r.left) / r.width) * 100;
          btn.style.backgroundPosition = `${x}% 50%`;
          btn.style.setProperty("--mx", `${x}%`);
        });
        btn.addEventListener("mouseleave", () => {
          btn.style.backgroundPosition = "";
          btn.style.removeProperty("--mx");
        });
      });
    }
  
    // ---------- Animated counters (Home stats) ----------
    function initCounters() {
      const nodes = $$("[data-count]");
      if (!nodes.length) return;
  
      const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (!e.isIntersecting) return;
            const el = e.target;
            io.unobserve(el);
  
            const to = Number(el.getAttribute("data-count") || "0");
            const suffix = el.getAttribute("data-suffix") || "";
            const prefix = el.getAttribute("data-prefix") || "";
            const duration = Math.min(1400, Math.max(700, to > 1000 ? 1100 : 900));
  
            const start = performance.now();
            const from = 0;
  
            const tick = (now) => {
              const t = Math.min(1, (now - start) / duration);
              const v = Math.round(from + (to - from) * easeOut(t));
              el.textContent = `${prefix}${formatNumber(v)}${suffix}`;
              if (t < 1) requestAnimationFrame(tick);
            };
  
            requestAnimationFrame(tick);
          });
        },
        { threshold: 0.35 }
      );
  
      nodes.forEach((n) => io.observe(n));
    }
  
    function formatNumber(n) {
      try {
        return new Intl.NumberFormat().format(n);
      } catch {
        return String(n);
      }
    }
  
    // ---------- Chatbot ----------
    function botReply(text) {
      // Intent: keep it short and helpful (product-like).
      const t = normalize(text);
      if (!t) return "Ask me for the fastest next step: urgent request, donor matching, or eligibility.";
      if (t.includes("urgent") || t.includes("emergency")) {
        return "Activate Emergency Mode on the Request page, set priority to Urgent, then open Find Donors to contact matches immediately.";
      }
      if (t.includes("blood group") || t.includes("group")) {
        return "Matching is driven by compatibility (blood group) and proximity (location). Use filters to surface high-confidence donors first.";
      }
      if (t.includes("register") || t.includes("donor")) {
        return "To become a donor, open Become a Lifesaver, add your details, and activate your profile. You’ll appear instantly in matching.";
      }
      if (t.includes("search") || t.includes("find")) {
        return "Open Find Donors, choose the blood group, then type a location. Tap Contact to call instantly—or copy the number in one click.";
      }
      if (t.includes("hello") || t.includes("hi")) {
        return "Hi—I'm BloodAI Assistant. Do you want to become a donor or request blood right now?";
      }
      return "I can guide you through donor activation, urgent requests, and matching. Try: “Find O- in Delhi” or “What’s the fastest emergency playbook?”";
    }
  
    function appendMessage(kind, text) {
      const list = $("#chatMessages");
      if (!list) return;
      const bubble = document.createElement("div");
      bubble.className = `bubble ${kind}`;
      bubble.textContent = text;
      list.appendChild(bubble);
      list.scrollTop = list.scrollHeight;
    }
  
    function initChatbot() {
      const panel = $("#chatPanel");
      const toggle = $("#chatToggle");
      const close = $("#chatClose");
      const input = $("#chatInput");
      const send = $("#chatSend");
  
      if (!panel || !toggle || !input || !send) return;
  
      const open = () => {
        panel.classList.add("open");
        setTimeout(() => input.focus(), 50);
      };
      const shut = () => panel.classList.remove("open");
  
      toggle.addEventListener("click", () => {
        panel.classList.toggle("open");
        if (panel.classList.contains("open")) input.focus();
      });
      close?.addEventListener("click", shut);
  
      const submit = () => {
        const text = input.value.trim();
        if (!text) return;
        appendMessage("user", text);
        input.value = "";
        window.setTimeout(() => appendMessage("bot", botReply(text)), 250);
      };
  
      send.addEventListener("click", submit);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submit();
        if (e.key === "Escape") shut();
      });
  
      // First-time greeting.
      if (!$("#chatMessages")?.children?.length) {
        appendMessage("bot", "I’m BloodAI Assistant—here to help you match donors faster and coordinate urgent requests with clarity.");
      }
  
      // Optional: open automatically on home after a short delay.
      if (document.body.dataset.page === "home") {
        setTimeout(() => {
          // Only nudge if user hasn't interacted yet.
          if (!panel.classList.contains("open")) open();
        }, 2500);
      }
    }
  
    // ---------- Register donor ----------
    function initRegisterForm() {
      const form = $("#donorForm");
      if (!form) return;
  
      form.addEventListener("submit", (e) => {
        e.preventDefault();
  
        form.classList.add("was-validated");
        if (!form.checkValidity()) {
          showToast("Please review the highlighted fields to continue.", "danger");
          return;
        }
  
        const donor = {
          id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
          name: $("#donorName")?.value.trim(),
          bloodGroup: bloodGroupLabel($("#donorBlood")?.value),
          location: $("#donorLocation")?.value.trim(),
          phone: $("#donorPhone")?.value.trim(),
          createdAt: new Date().toISOString(),
        };
  
        const donors = readJSON(STORAGE_KEYS.donors, []);
        donors.unshift(donor);
        writeJSON(STORAGE_KEYS.donors, donors);
  
        form.reset();
        form.classList.remove("was-validated");
        showToast("Profile activated. You’re now discoverable in donor matching.", "success");
  
        const jump = $("#afterRegister");
        jump?.classList.add("reveal-in");
      });
    }
  
    // ---------- Request blood ----------
    function initRequestForm() {
      const form = $("#requestForm");
      if (!form) return;
  
      const urgency = $("#requestUrgency");
      const urgencyBadge = $("#urgencyBadge");
  
      const syncUrgencyUI = () => {
        if (!urgency || !urgencyBadge) return;
        const v = urgency.value;
        if (v === "Urgent") {
          urgencyBadge.textContent = "Urgent";
          urgencyBadge.classList.add("badge-urgent");
        } else {
          urgencyBadge.textContent = "Normal";
          urgencyBadge.classList.remove("badge-urgent");
        }
      };
      urgency?.addEventListener("change", syncUrgencyUI);
      syncUrgencyUI();
  
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        form.classList.add("was-validated");
        if (!form.checkValidity()) {
          showToast("Please review the highlighted fields to continue.", "danger");
          return;
        }
  
        const req = {
          id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
          patientName: $("#patientName")?.value.trim(),
          bloodGroup: bloodGroupLabel($("#requestBlood")?.value),
          location: $("#requestLocation")?.value.trim(),
          phone: $("#requestPhone")?.value.trim(),
          urgency: urgency?.value || "Normal",
          createdAt: new Date().toISOString(),
        };
        const requests = readJSON(STORAGE_KEYS.requests, []);
        requests.unshift(req);
        writeJSON(STORAGE_KEYS.requests, requests);
  
        showToast("Request sent. Open matching to contact compatible donors now.", "success");
        form.reset();
        form.classList.remove("was-validated");
        syncUrgencyUI();
  
        const cta = $("#requestCta");
        if (cta) {
          cta.classList.remove("d-none");
          cta.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    }
  
    // ---------- Search donors ----------
    function renderDonors(list) {
      const grid = $("#donorGrid");
      const empty = $("#donorEmpty");
      if (!grid) return;
  
      grid.innerHTML = "";
      if (!list.length) {
        empty?.classList.remove("d-none");
        return;
      }
      empty?.classList.add("d-none");
  
      const frag = document.createDocumentFragment();
      list.forEach((d) => {
        const card = document.createElement("div");
        card.className = "col-12 col-md-6 col-lg-4";
        card.innerHTML = `
          <div class="glass donor-card p-4 h-100 reveal">
            <div class="d-flex align-items-start justify-content-between gap-3">
              <div class="d-flex align-items-center gap-3">
                <div class="profile">
                  <i class="fa-solid fa-user"></i>
                </div>
                <div>
                  <div class="fw-bold fs-5">${escapeHtml(d.name)}</div>
                  <div class="text-muted-2 small">
                    <i class="fa-solid fa-location-dot me-1"></i>${escapeHtml(d.location)}
                  </div>
                </div>
              </div>
              <span class="badge-soft badge-blood">${escapeHtml(bloodGroupLabel(d.bloodGroup))}</span>
            </div>
  
            <div class="mt-3 d-flex flex-wrap gap-2">
              <span class="badge-soft">
                <i class="fa-solid fa-shield-heart me-1"></i>Verified profile
              </span>
              <span class="badge-soft">
                <i class="fa-solid fa-bolt me-1"></i>Fast contact
              </span>
            </div>
  
            <div class="mt-4 d-flex gap-2">
              <a class="btn btn-premium btn-danger-premium w-100" href="tel:${encodeTel(d.phone)}">
                <i class="fa-solid fa-phone me-2"></i>Contact
              </a>
              <button class="btn btn-premium btn-ghost-premium" type="button" data-copy="${escapeAttr(d.phone)}" title="Copy phone">
                <i class="fa-regular fa-copy"></i>
              </button>
            </div>
          </div>
        `;
        frag.appendChild(card);
      });
  
      grid.appendChild(frag);
  
      // Copy buttons.
      $$("[data-copy]", grid).forEach((btn) => {
        btn.addEventListener("click", async () => {
          const value = btn.getAttribute("data-copy") || "";
          try {
            await navigator.clipboard.writeText(value);
            showToast("Phone copied to clipboard.", "success");
          } catch {
            showToast("Could not copy. You can still tap Contact.", "danger");
          }
        });
      });
  
      // Run reveal on newly added cards.
      initReveal();
    }
  
    function escapeHtml(s) {
      return String(s ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }
    function escapeAttr(s) {
      // Same as HTML for our use-case.
      return escapeHtml(s).replaceAll("`", "&#096;");
    }
    function encodeTel(phone) {
      // Keep only digits/+ for tel: links.
      const p = String(phone ?? "").trim();
      const cleaned = p.replace(/[^\d+]/g, "");
      return cleaned || p;
    }
  
    function initSearch() {
      const input = $("#searchInput");
      const group = $("#filterBlood");
      const sort = $("#sortBy");
      if (!input || !group) return;
  
      const run = () => {
        const q = normalize(input.value);
        const bg = bloodGroupLabel(group.value);
        const sortBy = sort?.value || "newest";
  
        const donors = readJSON(STORAGE_KEYS.donors, []);
  
        let filtered = donors.filter((d) => {
          const matchesGroup = !bg || bg === "ALL" ? true : bloodGroupLabel(d.bloodGroup) === bg;
          const matchesQ = !q
            ? true
            : normalize(d.name).includes(q) || normalize(d.location).includes(q) || normalize(d.phone).includes(q);
          return matchesGroup && matchesQ;
        });
  
        if (sortBy === "name") filtered = filtered.sort((a, b) => String(a.name).localeCompare(String(b.name)));
        if (sortBy === "location") filtered = filtered.sort((a, b) => String(a.location).localeCompare(String(b.location)));
        if (sortBy === "newest") filtered = filtered.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  
        renderDonors(filtered);
      };
  
      ["input", "change"].forEach((evt) => {
        input.addEventListener(evt, run);
        group.addEventListener(evt, run);
        sort?.addEventListener(evt, run);
      });
  
      // Seed demo donors once (to avoid an empty Search experience).
      seedIfEmpty();
      run();
    }
  
    function seedIfEmpty() {
      const donors = readJSON(STORAGE_KEYS.donors, []);
      if (donors.length) return;
      const now = Date.now();
      const demo = [
        { name: "Aarav Mehta", bloodGroup: "A+", location: "Mumbai", phone: "+91 98765 43210" },
        { name: "Sara Khan", bloodGroup: "O-", location: "Delhi", phone: "+91 91234 56780" },
        { name: "Rohan Patel", bloodGroup: "B+", location: "Ahmedabad", phone: "+91 99887 66554" },
        { name: "Nisha Verma", bloodGroup: "AB+", location: "Bengaluru", phone: "+91 90000 12345" },
        { name: "Kabir Singh", bloodGroup: "O+", location: "Pune", phone: "+91 95555 88990" },
        { name: "Ananya Iyer", bloodGroup: "A-", location: "Chennai", phone: "+91 93456 77881" },
      ].map((d, i) => ({
        id: String(now - i),
        ...d,
        createdAt: new Date(now - i * 3600_000).toISOString(),
      }));
      writeJSON(STORAGE_KEYS.donors, demo);
    }
  
    // ---------- Boot ----------
    document.addEventListener("DOMContentLoaded", () => {
      initNavbar();
      initReveal();
      initButtons();
      initCounters();
      initChatbot();
      initRegisterForm();
      initRequestForm();
      initSearch();
    });
  })();
  
  