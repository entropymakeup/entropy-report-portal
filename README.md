# Entropy Report Hub

Entropy Makeup HTML 보고 MOC 사이트 MVP입니다. 직원들이 만든 완성형 보고서를 정적 사이트로 모아 GitHub Pages에서 배포하는 구조입니다.

## 로컬 실행

Node.js 18 이상이 필요합니다.

```bash
npm run validate
npm run build
```

빌드 후 `dist/index.html`을 브라우저에서 열면 MOC 메인 페이지를 볼 수 있습니다.

간단한 로컬 서버로 확인하려면 Python이 설치된 환경에서 아래 명령을 사용할 수 있습니다.

```bash
python -m http.server 4173 --directory dist
```

## 보고서 추가 방법

1. `content/reports/`에 Markdown 파일을 추가합니다.
2. 파일명은 `YYYY-MM-DD_owner_short-title.md` 형식을 권장합니다.
3. frontmatter에는 아래 필드를 모두 넣습니다.

```yaml
---
title:
owner:
department:
report_type: status
decision_required: false
attention_required: true
status: normal
created_at: 2026-06-17
updated_at: 2026-06-17
summary:
---
```

4. `report_type`은 `decision` 또는 `status`만 사용합니다.
5. `decision` 보고서는 아래 4개 섹션을 사용합니다.

```markdown
## 요약
## 맥락과 판단 근거
## 리스크와 이익
## 최종 선택안
```

6. `status` 보고서는 아래 4개 섹션을 사용합니다.

```markdown
## 핵심 요약
## 지표 현황
## 주요 변화·이슈
## 다음 액션
```

7. `npm run validate`로 누락 필드와 섹션을 확인합니다.
8. `npm run build`로 `dist/`를 다시 생성합니다.

## GitHub Pages 배포

1. 이 폴더를 GitHub 저장소에 push합니다.
2. GitHub 저장소 secret에 `REPORT_PORTAL_PASSWORD`를 등록합니다.
3. GitHub 저장소의 `Settings > Pages`에서 Source를 `GitHub Actions`로 설정합니다.
4. `main` 브랜치에 push하면 `.github/workflows/pages.yml`이 실행됩니다.
5. Actions가 `npm run build`를 실행하고 `dist/`를 Pages artifact로 배포합니다.

비밀번호 게이트는 정적 사이트의 첫 화면을 가리는 장치입니다. 저장소가 public이면 저장소 파일 자체는 외부에서 볼 수 있으므로 민감한 보고서는 public 저장소에 넣지 않습니다.

## 빌드 결과

- `dist/index.html`: MOC 메인 페이지
- `dist/reports/{slug}/index.html`: 개별 보고서 페이지
- `dist/assets/`: CSS, JavaScript, 정적 에셋

## 운영 원칙

- 완성 화면에는 보고서 narrative와 보고 목록만 노출합니다.
- 작성 과정, 내부 질문, 작성 가이드, 도구 사용법은 사이트 화면에 넣지 않습니다.
- 원문에 없는 수치나 사실은 만들지 않습니다.
- 미확정 값은 `확인 필요`로 표시합니다.
- 첫 MVP는 작은 정적 구조를 유지하고, 복잡한 프레임워크를 도입하지 않습니다.
