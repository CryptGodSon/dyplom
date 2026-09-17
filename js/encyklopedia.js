(async function () {
  const password = OrderCrypto.storedPassword();
  if (!password) {
    window.location.replace("index.html");
    return;
  }

  let payload;
  try {
    payload = JSON.parse(await OrderCrypto.decryptFile("content/wiki.enc.json", password));
  } catch (err) {
    OrderCrypto.forget();
    window.location.replace("index.html");
    return;
  }

  const WIKI_ENTRIES = payload.entries;
  if (payload.meta) {
    const t = document.getElementById("wiki-title");
    const st = document.getElementById("wiki-subtitle");
    if (t && payload.meta.title) t.textContent = payload.meta.title;
    if (st && payload.meta.subtitle) st.textContent = payload.meta.subtitle;
    if (payload.meta.title) document.title = payload.meta.title;
  }

  const CATEGORY_LABELS = {
    glossary: "Słownik branżowy",
    abbr: "Skróty i akronimy",
    skills: "Soft skills",
  };

  const CATEGORY_ORDER = ["glossary", "abbr", "skills"];

  const BADGE_SHORT = {
    glossary: "Pojęcie",
    abbr: "Skrót",
    skills: "Skill",
  };

  /* ---------- Pomocnicze ---------- */

  function stripDiacritics(text) {
    return text
      .toLowerCase()
      .replace(/ł/g, "l")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
  }

  function slugify(text) {
    return stripDiacritics(text)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  const ENTRIES = WIKI_ENTRIES.map((entry) => ({
    ...entry,
    slug: slugify(entry.term),
    searchText: stripDiacritics(
      [
        entry.term,
        ...(entry.aliases || []),
        entry.summary,
        entry.detail,
        entry.why || "",
        entry.example || "",
      ].join(" ")
    ),
    termText: stripDiacritics([entry.term, ...(entry.aliases || [])].join(" ")),
  }));

  const bySlug = new Map(ENTRIES.map((e) => [e.slug, e]));
  const byTerm = new Map(ENTRIES.map((e) => [e.term, e]));

  const els = {
    wiki: document.getElementById("wiki"),
    search: document.getElementById("wiki-search"),
    tabs: Array.from(document.querySelectorAll(".wiki-tab")),
    index: document.getElementById("wiki-index"),
    empty: document.getElementById("wiki-empty"),
    content: document.getElementById("wiki-content"),
    random: document.getElementById("wiki-random"),
    clear: document.getElementById("wiki-clear"),
    count: document.getElementById("wiki-count"),
    total: document.getElementById("wiki-total"),
  };

  let selectedSlug = null;
  let filtered = [];

  /* ---------- Liczniki na zakładkach ---------- */

  function renderTabCounts() {
    els.tabs.forEach((tab) => {
      const category = tab.dataset.category;
      const n =
        category === "all"
          ? ENTRIES.length
          : ENTRIES.filter((e) => e.category === category).length;
      const counter = tab.querySelector(".wiki-tab-count");
      if (counter) counter.textContent = n;
    });
    if (els.total) els.total.textContent = ENTRIES.length;
  }

  /* ---------- Wyszukiwanie ---------- */

  function currentCategory() {
    const active = els.tabs.find((t) => t.classList.contains("active"));
    return active ? active.dataset.category : "all";
  }

  function getFilteredEntries() {
    const rawQuery = els.search.value.trim();
    const query = stripDiacritics(rawQuery);
    const category = currentCategory();

    const list = ENTRIES.filter((entry) => {
      const matchesCategory = category === "all" || entry.category === category;
      const matchesQuery = !query || entry.searchText.includes(query);
      return matchesCategory && matchesQuery;
    });

    if (!query) return list;

    // Trafienia w nazwie/aliasach idą na górę.
    return list.sort((a, b) => {
      const aTerm = a.termText.includes(query) ? 0 : 1;
      const bTerm = b.termText.includes(query) ? 0 : 1;
      return aTerm - bTerm;
    });
  }

  function highlight(text, rawQuery) {
    if (!rawQuery) return document.createTextNode(text);
    const idx = text.toLowerCase().indexOf(rawQuery.toLowerCase());
    if (idx === -1) return document.createTextNode(text);

    const frag = document.createDocumentFragment();
    frag.append(text.slice(0, idx));
    const mark = document.createElement("mark");
    mark.textContent = text.slice(idx, idx + rawQuery.length);
    frag.append(mark, text.slice(idx + rawQuery.length));
    return frag;
  }

  /* ---------- Lista haseł ---------- */

  function createIndexItem(entry, rawQuery) {
    const li = document.createElement("li");
    li.setAttribute("role", "presentation");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "wiki-index-item";
    button.setAttribute("role", "option");
    button.dataset.slug = entry.slug;
    const isActive = entry.slug === selectedSlug;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    button.tabIndex = isActive ? 0 : -1;

    const title = document.createElement("span");
    title.className = "wiki-index-term";
    title.appendChild(highlight(entry.term, rawQuery));

    const badge = document.createElement("span");
    badge.className = `wiki-badge wiki-badge--${entry.category}`;
    badge.textContent = BADGE_SHORT[entry.category] || entry.category;

    button.append(title, badge);
    button.addEventListener("click", () => selectEntry(entry.slug, { scroll: true }));

    li.appendChild(button);
    return li;
  }

  function renderIndex(entries) {
    const rawQuery = els.search.value.trim();
    els.index.innerHTML = "";

    const grouped = currentCategory() === "all";
    if (grouped) {
      CATEGORY_ORDER.forEach((category) => {
        const items = entries.filter((e) => e.category === category);
        if (!items.length) return;

        const header = document.createElement("li");
        header.className = "wiki-group";
        header.setAttribute("role", "presentation");
        header.textContent = `${CATEGORY_LABELS[category]} · ${items.length}`;
        els.index.appendChild(header);

        items.forEach((entry) => els.index.appendChild(createIndexItem(entry, rawQuery)));
      });
    } else {
      entries.forEach((entry) => els.index.appendChild(createIndexItem(entry, rawQuery)));
    }

    els.empty.hidden = entries.length > 0;
    if (els.count) {
      els.count.textContent = entries.length;
    }
    if (els.clear) {
      els.clear.hidden = !rawQuery;
    }
  }

  function syncActiveItems() {
    els.index.querySelectorAll(".wiki-index-item").forEach((item) => {
      const isActive = item.dataset.slug === selectedSlug;
      item.classList.toggle("active", isActive);
      item.setAttribute("aria-selected", String(isActive));
      item.tabIndex = isActive ? 0 : -1;
    });
  }

  /* ---------- Treść hasła ---------- */

  function makeBox(label, text, className) {
    const box = document.createElement("div");
    box.className = `wiki-box ${className}`;
    const heading = document.createElement("p");
    heading.className = "wiki-box-label";
    heading.textContent = label;
    const body = document.createElement("p");
    body.className = "wiki-box-text";
    body.textContent = text;
    box.append(heading, body);
    return box;
  }

  function renderContent(entry) {
    els.content.innerHTML = "";

    if (!entry) {
      els.content.innerHTML = `
        <div class="wiki-content-placeholder">
          <p class="wiki-content-placeholder-icon" aria-hidden="true">?</p>
          <p>Nic nie znaleziono dla tego filtra lub wyszukiwania.</p>
        </div>
      `;
      return;
    }

    const head = document.createElement("div");
    head.className = "wiki-content-head";

    const badge = document.createElement("span");
    badge.className = `wiki-badge wiki-badge--${entry.category} wiki-badge--lg`;
    badge.textContent = CATEGORY_LABELS[entry.category] || entry.category;

    const position = document.createElement("span");
    position.className = "wiki-content-position";
    const idx = filtered.findIndex((e) => e.slug === entry.slug);
    position.textContent = idx >= 0 ? `${idx + 1} z ${filtered.length}` : "";

    head.append(badge, position);

    const title = document.createElement("h2");
    title.className = "wiki-content-title";
    title.textContent = entry.term;

    const summary = document.createElement("p");
    summary.className = "wiki-content-summary";
    summary.textContent = entry.summary;

    const detail = document.createElement("p");
    detail.className = "wiki-content-detail";
    detail.textContent = entry.detail;

    els.content.append(head, title, summary, detail);

    if (entry.why) {
      els.content.appendChild(makeBox("Dlaczego to ważne na stażu", entry.why, "wiki-box--why"));
    }
    if (entry.example) {
      els.content.appendChild(makeBox("Jak to brzmi w praktyce", entry.example, "wiki-box--example"));
    }

    const related = (entry.related || [])
      .map((term) => byTerm.get(term))
      .filter(Boolean);

    if (related.length) {
      const wrap = document.createElement("div");
      wrap.className = "wiki-related";
      const label = document.createElement("p");
      label.className = "wiki-related-label";
      label.textContent = "Zobacz też";
      const chips = document.createElement("div");
      chips.className = "wiki-related-chips";
      related.forEach((rel) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "wiki-chip";
        chip.textContent = rel.term;
        chip.addEventListener("click", () => jumpTo(rel.slug));
        chips.appendChild(chip);
      });
      wrap.append(label, chips);
      els.content.appendChild(wrap);
    }

    // Poprzednie / następne w bieżącej liście
    if (filtered.length > 1 && idx >= 0) {
      const nav = document.createElement("div");
      nav.className = "wiki-nav";

      const prev = filtered[(idx - 1 + filtered.length) % filtered.length];
      const next = filtered[(idx + 1) % filtered.length];

      const prevBtn = document.createElement("button");
      prevBtn.type = "button";
      prevBtn.className = "wiki-nav-btn wiki-nav-btn--prev";
      prevBtn.innerHTML = `<span class="wiki-nav-dir">Poprzednie</span><span class="wiki-nav-term"></span>`;
      prevBtn.querySelector(".wiki-nav-term").textContent = prev.term;
      prevBtn.addEventListener("click", () => selectEntry(prev.slug, { scroll: true }));

      const nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "wiki-nav-btn wiki-nav-btn--next";
      nextBtn.innerHTML = `<span class="wiki-nav-dir">Następne</span><span class="wiki-nav-term"></span>`;
      nextBtn.querySelector(".wiki-nav-term").textContent = next.term;
      nextBtn.addEventListener("click", () => selectEntry(next.slug, { scroll: true }));

      nav.append(prevBtn, nextBtn);
      els.content.appendChild(nav);
    }
  }

  /* ---------- Wybór hasła ---------- */

  function selectEntry(slug, { scroll = false, updateHash = true } = {}) {
    selectedSlug = slug;
    const entry = bySlug.get(slug) || null;
    renderContent(entry);
    syncActiveItems();

    if (entry && updateHash) {
      history.replaceState(null, "", `#${entry.slug}`);
    }

    if (scroll && window.matchMedia("(max-width: 899px)").matches) {
      els.content.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // Skok do hasła spoza bieżącego filtra: czyści filtr, żeby hasło było widoczne.
  function jumpTo(slug) {
    const entry = bySlug.get(slug);
    if (!entry) return;

    const category = currentCategory();
    if (category !== "all" && category !== entry.category) {
      setActiveTab("all");
    }
    if (els.search.value.trim()) {
      els.search.value = "";
    }
    applyFilters({ keepSelection: slug });
    selectEntry(slug, { scroll: true });
  }

  function setActiveTab(category) {
    els.tabs.forEach((t) => {
      const on = t.dataset.category === category;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", String(on));
    });
  }

  function applyFilters({ keepSelection } = {}) {
    filtered = getFilteredEntries();
    renderIndex(filtered);

    const wanted = keepSelection || selectedSlug;
    const stillVisible = filtered.some((entry) => entry.slug === wanted);

    if (stillVisible) {
      selectEntry(wanted, { updateHash: false });
    } else {
      selectEntry(filtered.length ? filtered[0].slug : null, { updateHash: false });
    }
  }

  /* ---------- Klawiatura ---------- */

  function handleIndexKeys(event) {
    const items = Array.from(els.index.querySelectorAll(".wiki-index-item"));
    if (!items.length) return;
    const current = items.indexOf(document.activeElement);
    let target = null;

    switch (event.key) {
      case "ArrowDown":
        target = items[Math.min(items.length - 1, current + 1)];
        break;
      case "ArrowUp":
        target = items[Math.max(0, current - 1)];
        break;
      case "Home":
        target = items[0];
        break;
      case "End":
        target = items[items.length - 1];
        break;
      default:
        return;
    }

    event.preventDefault();
    if (target) {
      target.focus();
      selectEntry(target.dataset.slug);
    }
  }

  document.addEventListener("keydown", (event) => {
    const typing = ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName);
    if (event.key === "/" && !typing) {
      event.preventDefault();
      els.search.focus();
      els.search.select();
    }
  });

  els.search.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      els.search.value = "";
      applyFilters();
    }
    if (event.key === "ArrowDown") {
      const first = els.index.querySelector(".wiki-index-item.active") ||
        els.index.querySelector(".wiki-index-item");
      if (first) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  els.index.addEventListener("keydown", handleIndexKeys);

  /* ---------- Zdarzenia ---------- */

  els.search.addEventListener("input", () => applyFilters());

  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setActiveTab(tab.dataset.category);
      applyFilters();
    });
  });

  if (els.random) {
    els.random.addEventListener("click", () => {
      const pool = filtered.length ? filtered : ENTRIES;
      const candidates = pool.filter((e) => e.slug !== selectedSlug);
      const pick = (candidates.length ? candidates : pool)[
        Math.floor(Math.random() * (candidates.length ? candidates.length : pool.length))
      ];
      if (pick) jumpTo(pick.slug);
    });
  }

  if (els.clear) {
    els.clear.addEventListener("click", () => {
      els.search.value = "";
      applyFilters();
      els.search.focus();
    });
  }

  window.addEventListener("hashchange", () => {
    const slug = decodeURIComponent(location.hash.slice(1));
    if (slug && bySlug.has(slug) && slug !== selectedSlug) jumpTo(slug);
  });

  /* ---------- Start ---------- */

  renderTabCounts();
  els.wiki.hidden = false;

  const initialSlug = decodeURIComponent(location.hash.slice(1));
  if (initialSlug && bySlug.has(initialSlug)) {
    applyFilters({ keepSelection: initialSlug });
  } else {
    applyFilters();
  }
})();
