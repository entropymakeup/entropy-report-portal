(() => {
  const readStorageKey = "entropy-report-hub-read:v1";
  const cards = Array.from(document.querySelectorAll("[data-report-card]"));
  const filterCards = Array.from(document.querySelectorAll("[data-filter-card]"));
  const typeFilter = document.querySelector("#type-filter");
  const departmentFilter = document.querySelector("#department-filter");
  const statusFilter = document.querySelector("#status-filter");
  const emptyState = document.querySelector("#filtered-empty");
  const pageReport = document.querySelector("[data-report-page]");

  const getReadMap = () => {
    try {
      return JSON.parse(localStorage.getItem(readStorageKey) || "{}");
    } catch (_error) {
      return {};
    }
  };

  const saveReadMap = (map) => {
    localStorage.setItem(readStorageKey, JSON.stringify(map));
  };

  const isRead = (slug, updatedAt) => getReadMap()[slug] === updatedAt;

  const setRead = (slug, updatedAt, value) => {
    if (!slug || !updatedAt) return;
    const map = getReadMap();
    if (value) {
      map[slug] = updatedAt;
    } else {
      delete map[slug];
    }
    saveReadMap(map);
  };

  const reportIsRead = (card) => isRead(card.dataset.reportSlug, card.dataset.reportUpdatedAt);

  const updateCards = () => {
    cards.forEach((card) => {
      const read = reportIsRead(card);
      card.classList.toggle("is-read", read);
      card.classList.toggle("is-unread", !read);
      const state = card.querySelector("[data-read-state]");
      const toggle = card.querySelector("[data-read-toggle]");
      if (state) state.textContent = read ? "읽음" : "새 보고";
      if (toggle) toggle.textContent = read ? "읽지 않음으로 표시" : "읽음으로 표시";
    });
  };

  const updatePeople = () => {
    const personCards = Array.from(document.querySelectorAll("[data-person-card]"));
    personCards.forEach((personCard) => {
      const pairs = (personCard.dataset.personUpdated || "").split("|").filter(Boolean);
      const unread = pairs.filter((pair) => {
        const [slug, updatedAt] = pair.split(":");
        return slug && updatedAt && !isRead(slug, updatedAt);
      }).length;
      personCard.classList.toggle("has-unread", unread > 0);
      const label = personCard.querySelector("[data-person-unread]");
      if (label) {
        label.textContent = unread > 0 ? `${unread}건 미확인` : "모두 읽음";
      }
    });
  };

  const updateUnreadCount = () => {
    const unreadSlugs = new Set();
    cards.forEach((card) => {
      if (!reportIsRead(card)) unreadSlugs.add(card.dataset.reportSlug);
    });
    document.querySelectorAll("[data-unread-count]").forEach((node) => {
      node.textContent = `읽지 않은 보고 ${unreadSlugs.size}건`;
    });
  };

  const refreshReadState = () => {
    updateCards();
    updatePeople();
    updateUnreadCount();
  };

  if (pageReport) {
    const slug = pageReport.dataset.reportSlug;
    const updatedAt = pageReport.dataset.reportUpdatedAt;
    setRead(slug, updatedAt, true);
    const state = document.querySelector("[data-page-read-state]");
    const toggle = document.querySelector("[data-page-read-toggle]");
    if (state) state.textContent = "읽음 처리됨";
    if (toggle) {
      toggle.addEventListener("click", () => {
        const nextRead = !isRead(slug, updatedAt);
        setRead(slug, updatedAt, nextRead);
        state.textContent = nextRead ? "읽음 처리됨" : "읽지 않음";
        toggle.textContent = nextRead ? "읽지 않음으로 표시" : "읽음으로 표시";
      });
      toggle.textContent = "읽지 않음으로 표시";
    }
  }

  const setupReportPagination = () => {
    if (!pageReport || pageReport.dataset.reportPageMode !== "paginated") return;
    const sections = Array.from(pageReport.querySelectorAll("[data-report-section]"));
    if (sections.length <= 1) return;

    const pager = document.createElement("nav");
    pager.className = "report-pager";
    pager.setAttribute("aria-label", "보고서 페이지 이동");
    pager.innerHTML = `
      <button class="pager-button" type="button" data-page-prev>이전</button>
      <div class="page-tabs" role="tablist" aria-label="보고서 페이지"></div>
      <button class="pager-button" type="button" data-page-next>다음</button>
    `;

    const tabsWrap = pager.querySelector(".page-tabs");
    const tabs = sections.map((section, index) => {
      const button = document.createElement("button");
      button.className = "page-tab";
      button.type = "button";
      button.setAttribute("role", "tab");
      button.dataset.pageTarget = String(index);
      button.textContent = section.dataset.pageTitle || `Page ${index + 1}`;
      tabsWrap.appendChild(button);
      return button;
    });

    const reportMap = pageReport.querySelector(".report-map");
    reportMap?.after(pager);

    let activeIndex = Math.max(
      0,
      sections.findIndex((section) => `#${section.id}` === window.location.hash)
    );
    if (activeIndex === -1) activeIndex = 0;

    const setPage = (nextIndex, updateHash = false) => {
      activeIndex = Math.min(Math.max(nextIndex, 0), sections.length - 1);
      sections.forEach((section, index) => {
        const active = index === activeIndex;
        section.hidden = !active;
        section.classList.toggle("is-active-page", active);
      });
      tabs.forEach((tab, index) => {
        const active = index === activeIndex;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", String(active));
      });
      const prev = pager.querySelector("[data-page-prev]");
      const next = pager.querySelector("[data-page-next]");
      if (prev) prev.disabled = activeIndex === 0;
      if (next) next.disabled = activeIndex === sections.length - 1;
      if (updateHash) {
        history.replaceState(null, "", `#${sections[activeIndex].id}`);
      }
    };

    pager.addEventListener("click", (event) => {
      const target = event.target.closest("[data-page-target], [data-page-prev], [data-page-next]");
      if (!target) return;
      if (target.matches("[data-page-prev]")) setPage(activeIndex - 1, true);
      if (target.matches("[data-page-next]")) setPage(activeIndex + 1, true);
      if (target.matches("[data-page-target]")) setPage(Number(target.dataset.pageTarget), true);
      pager.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    pageReport.querySelectorAll(".toc-link").forEach((link) => {
      link.addEventListener("click", (event) => {
        const sectionIndex = sections.findIndex((section) => `#${section.id}` === link.getAttribute("href"));
        if (sectionIndex === -1) return;
        event.preventDefault();
        setPage(sectionIndex, true);
        pager.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    setPage(activeIndex);
  };

  const applyFilters = () => {
    if (!filterCards.length) return;
    const type = typeFilter?.value || "all";
    const department = departmentFilter?.value || "all";
    const status = statusFilter?.value || "all";
    let visible = 0;

    filterCards.forEach((card) => {
      const matches =
        (type === "all" || card.dataset.type === type) &&
        (department === "all" || card.dataset.department === department) &&
        (status === "all" || card.dataset.status === status);

      card.hidden = !matches;
      if (matches) visible += 1;
    });

    if (emptyState) emptyState.hidden = visible !== 0;
  };

  [typeFilter, departmentFilter, statusFilter].forEach((filter) => {
    filter?.addEventListener("change", applyFilters);
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-read-toggle]");
    const card = button?.closest("[data-report-card]");
    if (!button || !card) return;
    const nextRead = !reportIsRead(card);
    setRead(card.dataset.reportSlug, card.dataset.reportUpdatedAt, nextRead);
    refreshReadState();
  });

  refreshReadState();
  applyFilters();
  setupReportPagination();
})();
