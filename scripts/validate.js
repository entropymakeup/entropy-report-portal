const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const reportsDir = path.join(rootDir, "content", "reports");

const REQUIRED_FIELDS = [
  "title",
  "owner",
  "department",
  "report_type",
  "decision_required",
  "attention_required",
  "status",
  "created_at",
  "updated_at",
  "summary"
];

const SECTION_RULES = {
  decision: ["요약", "맥락과 판단 근거", "리스크와 이익", "최종 선택안"],
  status: ["핵심 요약", "지표 현황", "주요 변화·이슈", "다음 액션"]
};

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
  const lines = match[1].split(/\r?\n/);

  lines.forEach((line, index) => {
    if (!line.trim()) return;
    const separator = line.indexOf(":");
    if (separator === -1) {
      throw new Error(`${filePath}:${index + 2}: key: value 형식이 아닙니다.`);
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1);
    data[key] = parseValue(value);
  });

  return { data, body: match[2] };
}

function extractSections(body) {
  return body
    .split(/\r?\n/)
    .filter((line) => line.startsWith("## "))
    .map((line) => line.replace(/^##\s+/, "").trim());
}

function isDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isBoolean(value) {
  return value === true || value === false;
}

function validateReport(filePath) {
  const relativePath = path.relative(rootDir, filePath);
  const raw = fs.readFileSync(filePath, "utf8");
  const { data, body } = parseFrontmatter(raw, relativePath);
  const errors = [];

  REQUIRED_FIELDS.forEach((field) => {
    if (data[field] === undefined || data[field] === "") {
      errors.push(`${relativePath}: '${field}' 필수값이 누락되었습니다.`);
    }
  });

  if (!["decision", "status"].includes(data.report_type)) {
    errors.push(`${relativePath}: report_type은 decision 또는 status여야 합니다.`);
  }

  if (!isBoolean(data.decision_required)) {
    errors.push(`${relativePath}: decision_required는 true 또는 false여야 합니다.`);
  }

  if (!isBoolean(data.attention_required)) {
    errors.push(`${relativePath}: attention_required는 true 또는 false여야 합니다.`);
  }

  if (!["normal", "watch", "risk"].includes(data.status)) {
    errors.push(`${relativePath}: status는 normal, watch, risk 중 하나여야 합니다.`);
  }

  if (!isDate(data.created_at)) {
    errors.push(`${relativePath}: created_at은 YYYY-MM-DD 형식이어야 합니다.`);
  }

  if (!isDate(data.updated_at)) {
    errors.push(`${relativePath}: updated_at은 YYYY-MM-DD 형식이어야 합니다.`);
  }

  if (data.report_type === "decision" && data.decision_required !== true) {
    errors.push(`${relativePath}: decision 보고서는 decision_required가 true여야 합니다.`);
  }

  if (data.report_type === "status" && data.decision_required !== false) {
    errors.push(`${relativePath}: status 보고서는 decision_required가 false여야 합니다.`);
  }

  const expectedSections = SECTION_RULES[data.report_type] || [];
  const actualSections = extractSections(body);
  expectedSections.forEach((sectionTitle) => {
    if (!actualSections.includes(sectionTitle)) {
      errors.push(`${relativePath}: '${sectionTitle}' 섹션이 필요합니다.`);
    }
  });

  return errors;
}

function main() {
  if (!fs.existsSync(reportsDir)) {
    console.error("content/reports 폴더가 없습니다.");
    process.exit(1);
  }

  const reportFiles = fs
    .readdirSync(reportsDir)
    .filter((fileName) => fileName.endsWith(".md"))
    .map((fileName) => path.join(reportsDir, fileName));

  if (!reportFiles.length) {
    console.error("content/reports에 보고서 Markdown이 없습니다.");
    process.exit(1);
  }

  const errors = reportFiles.flatMap(validateReport);

  if (errors.length) {
    console.error("보고서 검증 실패:");
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log(`보고서 검증 성공: ${reportFiles.length}개`);
}

main();
