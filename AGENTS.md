# AGENTS.md

이 저장소는 Entropy Makeup HTML 보고 포털입니다. Codex와 Claude Code는 아래 규칙을 지켜 작업합니다.

## 화면 노출 원칙

- `dist/` 화면에는 완성된 보고서와 보고 목록만 표시합니다.
- 작성 가이드, 내부 프롬프트, AI 질문, 도구 사용법, 제작 과정은 화면에 넣지 않습니다.
- 보고서 내용은 독자가 자기 일처럼 바로 읽는 완성형 narrative로 작성합니다.
- 원문에 없는 수치, 일정, 담당자, 결과를 임의로 만들지 않습니다.
- 누락되거나 미확정인 값은 `확인 필요`로 표시합니다.

## 보고서 유형

- `decision`: 의사결정 필요 보고
- `status`: 의사결정 불필요 / 현황공유형 보고

`decision` 보고서는 반드시 아래 섹션을 사용합니다.

```markdown
## 요약
## 맥락과 판단 근거
## 리스크와 이익
## 최종 선택안
```

`status` 보고서는 반드시 아래 섹션을 사용합니다.

```markdown
## 핵심 요약
## 지표 현황
## 주요 변화·이슈
## 다음 액션
```

강의안, 온보딩 구성안처럼 문서 자체의 목차와 진행안이 본문인 경우에는 `content_format: lecture_outline`를 사용할 수 있습니다. 이 경우 지표·변화 틀에 억지로 맞추지 않고 아래 섹션을 사용합니다.

```markdown
## 강의 목표
## 강의 목차
## 세션별 진행안
## 팀별 실습 예시
## HTML 보고 실습
## 운영 메모
```

## Markdown frontmatter

모든 보고서는 최소 아래 필드를 가져야 합니다.

```yaml
---
title:
owner:
department:
report_type:
decision_required:
attention_required:
status:
content_format:
created_at:
updated_at:
summary:
---
```

허용값:

- `report_type`: `decision`, `status`
- `decision_required`: `true`, `false`
- `attention_required`: `true`, `false`
- `status`: `normal`, `watch`, `risk`
- `content_format`: 생략 가능, 강의안 예외만 `lecture_outline`

## 구현 규칙

- 정적 사이트 구조를 유지합니다.
- 기본 구현은 HTML, CSS, JavaScript, Node.js build script만 사용합니다.
- `src/`는 템플릿과 정적 소스입니다.
- `content/reports/`는 보고서 원문입니다.
- `dist/`는 빌드 결과이며 직접 수정하지 않습니다.
- 새 보고서 추가 후에는 `npm run validate`와 `npm run build`를 실행합니다.

## 디자인 규칙

- 민트, 화이트, 라이트 그레이, 딥 그레이를 기본 톤으로 사용합니다.
- 보고용 UI이므로 판단 속도와 가독성을 우선합니다.
- 모바일과 데스크톱 모두에서 목록, 카드, 표가 깨지지 않아야 합니다.
- 과한 장식, 과한 애니메이션, 마케팅형 랜딩 구성을 피합니다.
