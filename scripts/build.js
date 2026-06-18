const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const crypto = require("crypto");

const rootDir = path.resolve(__dirname, "..");
const srcDir = path.join(rootDir, "src");
const reportsDir = path.join(rootDir, "content", "reports");
const peoplePath = path.join(rootDir, "content", "people.yml");
const publicDir = path.join(rootDir, "public");
const distDir = path.join(rootDir, "dist");

const TYPE_LABELS = {
  decision: "의사결정 필요",
  status: "현황 공유"
};

const STATUS_LABELS = {
  normal: "정상",
  watch: "관찰",
  risk: "위험"
};

const STATUS_CLASSES = {
  normal: "badge-normal",
  watch: "badge-watch",
  risk: "badge-risk"
};

const PAGE_LABELS = {
  decision: {
    brandTitle: "Decision Report",
    brandSubtitle: "HTML report",
    surfaceKicker: "Decision Request",
    tocKicker: "Report Map",
    tocTitle: "보고 목차",
    footerLabel: "Internal Decision Report"
  },
  status: {
    brandTitle: "Status Brief",
    brandSubtitle: "HTML report",
    surfaceKicker: "Status Update",
    tocKicker: "Report Map",
    tocTitle: "보고 목차",
    footerLabel: "Internal Status Brief"
  },
  lecture_outline: {
    brandTitle: "Learning Note",
    brandSubtitle: "HTML outline",
    surfaceKicker: "Learning Outline",
    tocKicker: "Document Map",
    tocTitle: "문서 목차",
    footerLabel: "Internal Learning Note"
  },
  source_note: {
    brandTitle: "Source Note",
    brandSubtitle: "HTML note",
    surfaceKicker: "Source Note",
    tocKicker: "Document Map",
    tocTitle: "문서 목차",
    footerLabel: "Internal Source Note"
  }
};

const DEPARTMENT_ORDER = [
  "경영",
  "미국 TF",
  "일본 TF",
  "Creative 팀",
  "Growth 팀",
  "퍼포먼스 마케팅팀",
  "브랜드 마케팅팀",
  "SCM팀",
  "CEO팀",
  "외부조직"
];

function departmentRank(department) {
  const index = DEPARTMENT_ORDER.indexOf(department);
  return index === -1 ? DEPARTMENT_ORDER.length : index;
}

function compareDepartments(a, b) {
  const rankDiff = departmentRank(a) - departmentRank(b);
  if (rankDiff !== 0) return rankDiff;
  return String(a).localeCompare(String(b), "ko");
}

function comparePeople(a, b) {
  const orderDiff = Number(a.order ?? 999) - Number(b.order ?? 999);
  if (orderDiff !== 0) return orderDiff;
  if (a.leader === b.leader) return String(a.name).localeCompare(String(b.name), "ko");
  return a.leader ? -1 : 1;
}

function runValidation() {
  const result = spawnSync(process.execPath, [path.join(__dirname, "validate.js")], {
    cwd: rootDir,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function parseValue(value) {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseFrontmatter(raw, filePath) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new Error(`${filePath}: frontmatter가 없습니다.`);
  }

  const data = {};
  match[1].split(/\r?\n/).forEach((line) => {
    if (!line.trim()) return;
    const separator = line.indexOf(":");
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1);
    data[key] = parseValue(value);
  });

  return { data, body: match[2] };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "") || "section";
}

function formatDate(value) {
  if (!value) return "확인 필요";
  const parts = String(value).split("-");
  if (parts.length !== 3) return escapeHtml(value);
  return `${parts[0]}.${parts[1]}.${parts[2]}`;
}

function renderInline(value) {
  let html = escapeHtml(value);
  html = html.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, target, label) => `<span class="wiki-link">${label || target}</span>`);
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/`(.+?)`/g, "<code>$1</code>");
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, label, href) => `<a href="${escapeAttribute(href)}">${label}</a>`
  );
  return html;
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderTable(lines, startIndex) {
  const header = splitTableRow(lines[startIndex]);
  let index = startIndex + 2;
  const rows = [];

  while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
    rows.push(splitTableRow(lines[index]));
    index += 1;
  }

  const headHtml = header.map((cell) => `<th>${renderInline(cell)}</th>`).join("");
  const bodyHtml = rows
    .map(
      (row) =>
        `<tr>${row
          .map((cell, cellIndex) => `<td data-label="${escapeAttribute(header[cellIndex] || "")}">${renderInline(cell)}</td>`)
          .join("")}</tr>`
    )
    .join("");

  return {
    html: `<div class="table-wrap"><table><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`,
    nextIndex: index
  };
}

function renderImage(line) {
  const match = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
  if (!match) return null;
  const alt = match[1].trim();
  const href = match[2].trim();
  const caption = alt ? `<figcaption>${escapeHtml(alt)}</figcaption>` : "";
  return `<figure class="report-figure"><img src="${escapeAttribute(href)}" alt="${escapeAttribute(alt)}" />${caption}</figure>`;
}

function isHorizontalRule(line) {
  return /^\s*-{3,}\s*$/.test(line) || /^<hr\b/i.test(line.trim());
}

function isBlockBoundary(lines, index) {
  const line = lines[index];
  return (
    !line.trim() ||
    line.startsWith("### ") ||
    line.startsWith("#### ") ||
    line.trim().startsWith("```") ||
    line.trim().startsWith(">") ||
    isHorizontalRule(line) ||
    /^\s*-\s+/.test(line) ||
    /^\s*\d+\.\s+/.test(line) ||
    (line.includes("|") && lines[index + 1] && isTableSeparator(lines[index + 1]))
  );
}

function renderMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/);
  const html = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const imageHtml = renderImage(line.trim());
    if (imageHtml) {
      html.push(imageHtml);
      index += 1;
      continue;
    }

    if (isHorizontalRule(line)) {
      html.push('<hr class="report-divider" />');
      index += 1;
      continue;
    }

    if (line.trim().startsWith("```")) {
      const code = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    if (line.trim().startsWith(">")) {
      const quote = [];
      while (index < lines.length && lines[index].trim().startsWith(">")) {
        quote.push(lines[index].replace(/^\s*>\s?/, "").trim());
        index += 1;
      }
      html.push(`<blockquote>${renderInline(quote.join(" "))}</blockquote>`);
      continue;
    }

    if (line.startsWith("### ")) {
      html.push(`<h3>${renderInline(line.replace(/^###\s+/, "").trim())}</h3>`);
      index += 1;
      continue;
    }

    if (line.startsWith("#### ")) {
      html.push(`<h4>${renderInline(line.replace(/^####\s+/, "").trim())}</h4>`);
      index += 1;
      continue;
    }

    if (line.includes("|") && lines[index + 1] && isTableSeparator(lines[index + 1])) {
      const rendered = renderTable(lines, index);
      html.push(rendered.html);
      index = rendered.nextIndex;
      continue;
    }

    if (/^\s*-\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*-\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*-\s+/, "").trim());
        index += 1;
      }
      html.push(`<ul>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, "").trim());
        index += 1;
      }
      html.push(`<ol>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ol>`);
      continue;
    }

    const paragraph = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !isBlockBoundary(lines, index)
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }

    html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
  }

  return html.join("\n");
}

function extractSections(body) {
  const sections = [];
  const lines = body.split(/\r?\n/);
  let current = null;

  lines.forEach((line) => {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      if (current) sections.push(current);
      current = { title: heading[1].trim(), markdown: [] };
      return;
    }
    if (current) current.markdown.push(line);
  });

  if (current) sections.push(current);
  return sections;
}

function renderTemplate(template, values) {
  return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_match, key) => values[key] ?? "");
}

function copyFile(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function copyDir(source, target) {
  if (!fs.existsSync(source)) return;
  fs.readdirSync(source, { withFileTypes: true }).forEach((entry) => {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDir(sourcePath, targetPath);
    } else {
      copyFile(sourcePath, targetPath);
    }
  });
}

function writeAuthConfig() {
  const password = process.env.REPORT_PORTAL_PASSWORD?.trim();
  const passwordHash = process.env.REPORT_PORTAL_PASSWORD_HASH ||
    (password ? crypto.createHash("sha256").update(password, "utf8").digest("hex") : "");
  const enabled = Boolean(passwordHash);

  const config = `window.REPORT_PORTAL_AUTH = ${JSON.stringify({
    enabled,
    passwordHash,
    assetBase: "./assets/"
  })};\n`;

  fs.writeFileSync(path.join(distDir, "assets", "config.js"), config, "utf8");
}

function readReports() {
  return fs
    .readdirSync(reportsDir)
    .filter((fileName) => fileName.endsWith(".md"))
    .map((fileName) => {
      const filePath = path.join(reportsDir, fileName);
      const raw = fs.readFileSync(filePath, "utf8");
      const { data, body } = parseFrontmatter(raw, fileName);
      const slug = fileName.replace(/\.md$/, "");
      const sections = extractSections(body);

      return {
        ...data,
        slug,
        url: `./reports/${slug}/index.html`,
        sourcePath: filePath,
        sections
      };
    })
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
}

function readPeople() {
  if (!fs.existsSync(peoplePath)) return [];

  const people = [];
  let current = null;

  fs.readFileSync(peoplePath, "utf8").split(/\r?\n/).forEach((line) => {
    const itemMatch = line.match(/^\s*-\s+id:\s*(.+)\s*$/);
    if (itemMatch) {
      if (current) people.push(current);
      current = { id: parseValue(itemMatch[1]) };
      return;
    }

    if (!current) return;
    const fieldMatch = line.match(/^\s+([a-zA-Z0-9_]+):\s*(.*)\s*$/);
    if (fieldMatch) {
      current[fieldMatch[1]] = parseValue(fieldMatch[2]);
    }
  });

  if (current) people.push(current);
  return people;
}

function splitList(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function requestedReportsForPerson(reports, person) {
  return reports.filter((report) => {
    const requested = splitList(report.requested_to);
    if (requested.length) {
      return requested.includes(person.id) || requested.includes(person.name);
    }
    return report.owner === person.name;
  });
}

function renderMetaItems(report) {
  const items = [
    ["보고 부서", report.department],
    ["담당자", report.owner],
    ["보고 유형", TYPE_LABELS[report.report_type]],
    ["작성일", formatDate(report.created_at)]
  ];

  return items
    .map(
      ([label, value]) =>
        `<div class="meta-item"><b>${escapeHtml(label)}</b><span>${escapeHtml(value)}</span></div>`
    )
    .join("");
}

function renderTocItems(sections) {
  return sections
    .map((section, index) => {
      const num = String(index + 1).padStart(2, "0");
      const id = slugify(section.title);
      return `<a class="toc-link" href="#${id}"><span class="toc-num">${num}</span><span class="toc-label">${escapeHtml(section.title)}</span></a>`;
    })
    .join("");
}

function renderReportSections(sections) {
  return sections
    .map((section, index) => {
      const num = String(index + 1).padStart(2, "0");
      const id = slugify(section.title);
      return `<section class="report-section" id="${id}" data-report-section data-page-index="${index}" data-page-title="${escapeAttribute(section.title)}">
  <div class="wrap">
    <div class="section-head">
      <div>
        <div class="section-kicker">${num}</div>
        <h2>${escapeHtml(section.title)}</h2>
      </div>
    </div>
    <div class="report-section-content">
      ${renderMarkdown(section.markdown.join("\n"))}
    </div>
  </div>
</section>`;
    })
    .join("\n");
}

function renderReportPage(report) {
  const templatePath = path.join(srcDir, "templates", `${report.report_type}.html`);
  const template = fs.readFileSync(templatePath, "utf8");
  const pageLabels = PAGE_LABELS[report.content_format] || PAGE_LABELS[report.report_type];
  const pageMode = report.page_mode === "paginated" ? "paginated" : "scroll";
  return renderTemplate(template, {
    brand_title: escapeHtml(pageLabels.brandTitle),
    brand_subtitle: escapeHtml(pageLabels.brandSubtitle),
    surface_kicker: escapeHtml(pageLabels.surfaceKicker),
    toc_kicker: escapeHtml(pageLabels.tocKicker),
    toc_title: escapeHtml(pageLabels.tocTitle),
    footer_label: escapeHtml(pageLabels.footerLabel),
    title: escapeHtml(report.title),
    summary: escapeHtml(report.summary),
    owner: escapeHtml(report.owner),
    department: escapeHtml(report.department),
    slug: escapeAttribute(report.slug),
    updated_at: escapeAttribute(report.updated_at),
    page_mode: escapeAttribute(pageMode),
    updated_at_display: formatDate(report.updated_at),
    status_label: STATUS_LABELS[report.status],
    status_class: STATUS_CLASSES[report.status],
    meta_items: renderMetaItems(report),
    toc_items: renderTocItems(report.sections),
    sections: renderReportSections(report.sections)
  });
}

function renderReportCard(report, filterable = false) {
  const typeClass = report.report_type === "decision" ? "badge-decision" : "badge-status";
  const attentionClass = report.attention_required ? " attention" : "";
  const filterAttrs = filterable
    ? ` data-report-card data-filter-card data-report-slug="${escapeAttribute(report.slug)}" data-report-updated-at="${escapeAttribute(report.updated_at)}" data-type="${escapeAttribute(report.report_type)}" data-department="${escapeAttribute(report.department)}" data-status="${escapeAttribute(report.status)}"`
    : ` data-report-card data-report-slug="${escapeAttribute(report.slug)}" data-report-updated-at="${escapeAttribute(report.updated_at)}"`;

  return `<article class="report-card${attentionClass}"${filterAttrs}>
  <div class="report-top">
    <span class="report-status-set">
      <span class="badge ${typeClass}">${TYPE_LABELS[report.report_type]}</span>
      <span class="badge ${STATUS_CLASSES[report.status]}">${STATUS_LABELS[report.status]}</span>
    </span>
    <span class="badge read-indicator" data-read-state>새 보고</span>
  </div>
  <h3>${escapeHtml(report.title)}</h3>
  <p>${escapeHtml(report.summary)}</p>
  <dl class="report-meta">
    <div><dt>담당</dt><dd>${escapeHtml(report.owner)}</dd></div>
    <div><dt>부서</dt><dd>${escapeHtml(report.department)}</dd></div>
    <div><dt>업데이트</dt><dd>${formatDate(report.updated_at)}</dd></div>
    <div><dt>상태</dt><dd>${report.attention_required ? "후속 확인" : "정상"}</dd></div>
  </dl>
  <div class="report-actions">
    <a class="button" href="${escapeAttribute(report.url)}">보고서 보기</a>
    <button class="read-toggle" type="button" data-read-toggle>읽음으로 표시</button>
  </div>
</article>`;
}

function renderEmpty(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean))).sort(compareDepartments);
}

function renderFilters(reports) {
  const departments = unique(reports.map((report) => report.department));
  const statusOptions = unique(reports.map((report) => report.status));

  const departmentOptions = departments
    .map((department) => `<option value="${escapeAttribute(department)}">${escapeHtml(department)}</option>`)
    .join("");

  const statusOptionHtml = statusOptions
    .map((status) => `<option value="${escapeAttribute(status)}">${STATUS_LABELS[status]}</option>`)
    .join("");

  return `<label class="field"><span>유형</span><select id="type-filter">
  <option value="all">전체</option>
  <option value="decision">의사결정</option>
  <option value="status">현황</option>
</select></label>
<label class="field"><span>부서</span><select id="department-filter">
  <option value="all">전체</option>
  ${departmentOptions}
</select></label>
<label class="field"><span>상태</span><select id="status-filter">
  <option value="all">전체</option>
  ${statusOptionHtml}
</select></label>`;
}

function renderSummaryCards(reports) {
  const decisionCount = reports.filter((report) => report.decision_required).length;
  const statusCount = reports.filter((report) => report.report_type === "status").length;
  const latest = reports[0]?.updated_at;

  const cards = [
    ["전체 보고", `${reports.length}건`, "등록된 완성 보고서"],
    ["결정 필요", `${decisionCount}건`, "우선 확인 대상"],
    ["현황 보고", `${statusCount}건`, "공유형 보고"],
    ["최근 업데이트", formatDate(latest), "기준일"]
  ];

  return cards
    .map(
      ([label, value, note]) =>
        `<div class="stat-card"><span class="stat-label">${label}</span><span class="stat-value">${value}</span><span class="stat-note">${note}</span></div>`
    )
    .join("");
}

function renderPeopleBoard(people, reports) {
  if (!people.length) return renderEmpty("등록된 직원 정보가 없습니다.");

  const departments = new Map();
  people.forEach((person) => {
    const department = person.department || "미분류";
    if (!departments.has(department)) departments.set(department, []);
    departments.get(department).push(person);
  });

  const blocks = Array.from(departments.entries())
    .sort((a, b) => compareDepartments(a[0], b[0]))
    .map(([department, departmentPeople]) => {
      const orderedPeople = departmentPeople.sort(comparePeople);

      const totalRequests = orderedPeople.reduce(
        (sum, person) => sum + requestedReportsForPerson(reports, person).length,
        0
      );

      const peopleHtml = orderedPeople
        .map((person) => {
          const requestedReports = requestedReportsForPerson(reports, person);
          const slugs = requestedReports.map((report) => report.slug).join("|");
          const updated = requestedReports.map((report) => `${report.slug}:${report.updated_at}`).join("|");
          const leaderBadge = person.leader ? '<span class="pill ok">리더</span>' : "";
          return `<li class="person-card" data-person-card data-person-id="${escapeAttribute(person.id)}" data-person-slugs="${escapeAttribute(slugs)}" data-person-updated="${escapeAttribute(updated)}">
  <div class="person-main">
    <span class="person-name"><span class="unread-light" aria-hidden="true"></span>${escapeHtml(person.name)} ${leaderBadge}</span>
    <span class="person-role">${escapeHtml(person.role || "역할 확인 필요")}</span>
  </div>
  <span class="count" data-person-unread>${requestedReports.length}건 요청</span>
</li>`;
        })
        .join("");

      return `<section class="department-block">
  <h3><span>${escapeHtml(department)}</span><span class="count">${orderedPeople.length}명 · ${totalRequests}건</span></h3>
  <ul class="people-list">${peopleHtml}</ul>
</section>`;
    })
    .join("");

  return `<div class="people-board">${blocks}</div>`;
}

function groupReports(reports, key) {
  const groups = new Map();
  reports.forEach((report) => {
    const groupName = report[key] || "미분류";
    if (!groups.has(groupName)) groups.set(groupName, []);
    groups.get(groupName).push(report);
  });
  const compare = key === "department"
    ? (a, b) => compareDepartments(a[0], b[0])
    : (a, b) => a[0].localeCompare(b[0], "ko");
  return Array.from(groups.entries()).sort(compare);
}

function renderGroups(reports, key) {
  const groups = groupReports(reports, key);
  if (!groups.length) return renderEmpty("등록된 보고서가 없습니다.");

  const items = groups
    .map(([groupName, groupReportsForKey]) => {
      const latestReport = groupReportsForKey[0];
      return `<li><a href="${escapeAttribute(latestReport.url)}"><span>${escapeHtml(groupName)}</span><span class="count">${groupReportsForKey.length}건</span></a></li>`;
    })
    .join("");

  return `<ul class="group-list">${items}</ul>`;
}

function renderIndex(reports) {
  const template = fs.readFileSync(path.join(srcDir, "index.html"), "utf8");
  const people = readPeople();
  const latestReports = reports.map((report) => renderReportCard(report, true)).join("");
  const decisionReports = reports
    .filter((report) => report.decision_required)
    .map((report) => renderReportCard(report))
    .join("");
  const statusReports = reports
    .filter((report) => report.report_type === "status")
    .map((report) => renderReportCard(report))
    .join("");

  return renderTemplate(template, {
    generated_at: formatDate(new Date().toISOString().slice(0, 10)),
    last_updated: formatDate(reports[0]?.updated_at),
    total_count: reports.length,
    summary_cards: renderSummaryCards(reports),
    people_board: renderPeopleBoard(people, reports),
    filters: renderFilters(reports),
    latest_reports: latestReports || renderEmpty("등록된 보고서가 없습니다."),
    decision_reports: decisionReports || renderEmpty("현재 결정 필요한 보고가 없습니다."),
    status_reports: statusReports || renderEmpty("현재 현황 공유 보고가 없습니다."),
    owner_groups: renderGroups(reports, "owner"),
    department_groups: renderGroups(reports, "department")
  });
}

function main() {
  runValidation();

  if (!distDir.startsWith(rootDir)) {
    throw new Error("dist 경로가 프로젝트 밖에 있습니다.");
  }

  const reports = readReports();

  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(distDir, "assets"), { recursive: true });

  copyFile(path.join(srcDir, "styles.css"), path.join(distDir, "assets", "styles.css"));
  copyFile(path.join(srcDir, "app.js"), path.join(distDir, "assets", "app.js"));
  copyFile(path.join(srcDir, "gate.js"), path.join(distDir, "assets", "gate.js"));
  copyDir(path.join(publicDir, "assets"), path.join(distDir, "assets"));
  writeAuthConfig();

  fs.writeFileSync(path.join(distDir, "index.html"), renderIndex(reports), "utf8");

  reports.forEach((report) => {
    const targetDir = path.join(distDir, "reports", report.slug);
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, "index.html"), renderReportPage(report), "utf8");
  });

  console.log(`빌드 완료: dist/index.html 및 보고서 ${reports.length}개 생성`);
}

main();
