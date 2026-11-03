# Quantum Materials & Photonics Lab

서강대학교 H. Baek Research Group 홈페이지 소스입니다. GitHub Pages용 정적 사이트이며 별도 프레임워크나 유료 CMS 없이 운영합니다.

- 공개 주소: [https://sogangqmpl.github.io/](https://sogangqmpl.github.io/)
- GitHub 저장소: [SogangQMPL/sogangqmpl.github.io](https://github.com/SogangQMPL/sogangqmpl.github.io)

홈에는 수정 가능한 공지와 News 3건, Publications 3편을 표시합니다. 화면 변경 내역은 [디자인 수정 기록](docs/디자인-수정-기록.md)에 정리했습니다.

## 평소 수정하기

교수님과 새 담당자는 [간편 관리 안내](https://sogangqmpl.github.io/admin/guide.html)부터 보세요. 공용 GitHub 계정 **SogangQMPL**을 사용하며, 편집기에서 파일 업로드와 게시 상태 화면을 바로 열 수 있습니다. 항목별 설명과 기술 설정은 [상세 관리 안내](docs/상세관리안내.md)에 있습니다.

1. 홈페이지 주소 뒤에 `/admin/`을 붙여 한국어 편집기를 엽니다.
2. 공지, 연구 주제·관련 논문, 구성원, 소식 등을 수정하고 미리보기로 확인합니다.
3. 편집기에서 `site.json`을 다운로드합니다.
4. GitHub 저장소의 `content/site.json`을 내려받은 파일로 교체하고 `main` 브랜치에 Commit합니다.
5. **Actions → Publish lab website**가 완료되면 홈페이지에서 변경 내용을 확인합니다.

**초안 저장과 다운로드는 게시가 아닙니다.** 초안은 현재 브라우저에 저장되며, GitHub에 반영한 뒤 Pages 배포가 완료되어야 공개됩니다. 편집기에는 비밀번호나 GitHub 토큰을 입력하지 않습니다. 자세한 절차는 [관리안내.md](관리안내.md)를 따르세요.

내용은 `content/site.json`, 화면 구성은 `renderer.js`, 디자인은 `styles.css`에 있습니다. 기존 데이터의 알 수 없는 필드는 편집기에서 보존합니다.

## 먼저 보기

Windows에서는 `미리보기.cmd`를 더블클릭한 뒤 표시된 주소를 브라우저에서 엽니다. 실행 중인 터미널 창을 유지하세요.

Node.js 20 이상에서 직접 실행할 수도 있습니다. 외부 패키지 설치는 필요 없습니다.

```powershell
node scripts/check.mjs
node scripts/build.mjs
node scripts/serve.mjs
```

사이트: <http://127.0.0.1:4173/> · 한국어 편집기: <http://127.0.0.1:4173/admin/>

서버를 종료하려면 터미널에서 `Ctrl+C`를 누릅니다. 실제 내용을 바꿀 때는 내려받은 JSON으로 원본 `content/site.json`을 교체하고 다시 빌드합니다.

## 페이지 구성

| 메뉴·기능 | 파일 | 내용 |
| --- | --- | --- |
| Home | `index.html` | 상단 공지, News 3건, Publications 3편 |
| Member · Professor | `people.html` | 교수 소개 1명 |
| Member · Students | `students.html` | 학생 소개 7명 |
| Publication | `publications.html` | 게재 논문 46편, 검색·연도 필터, 별도 Under review 목록 |
| Research | `research.html` | 3개 대주제, 5개 하위 주제, 연구 그림·관련 논문 |
| Highlights · News | `news.html` | 연구실 소식 16건, 내부 게시물로 연결 |
| Highlights · Activities | `activities.html` | 연구실 활동 2건, 내부 게시물로 연결 |
| 개별 게시물 | `post-{id}.html` | 각 소식·활동의 본문과 사진 |
| Join Us | `join.html` | 모집·문의 |

목록·소개 페이지 8개와 개별 게시물 18개가 있습니다. 한국어 편집기와 관리 안내 화면은 별도입니다. JavaScript 없이도 본문과 사진을 읽을 수 있으며 검색·필터와 편집기는 JavaScript를 사용합니다.

소식·활동은 내부 게시물에서 읽으며, 사진은 `assets/posts/`에서 제공합니다. 사진을 누르면 원본이 열립니다. [게시물 이관 기록](docs/게시물-이관-기록.json)과 [2026년 10월 추가 기록](docs/2026-10-게시물-추가.json)에 출처와 파일 정보를 보관합니다.

## 연구 주제와 자료

- **Quantum information:** Quantum light sources, SPDC
- **Solid-State Physics:** Moiré physics, Interlayer excitons
- **Semiconductor Devices:** 2D semiconductor devices

각 하위 주제는 대표 그림, 설명과 Related papers로 구성합니다. 자세한 설명과 추가 그림은 **DETAIL**을 눌러 펼칩니다. 관련 논문 13편은 각 하위 주제에만 연결하며, SPDC에는 확인하지 못한 게재 실적을 임의로 연결하지 않았습니다.

대표 그림 4개는 Wix 원본 또는 원본에서 잘라낸 그림입니다. Quantum light sources는 실제 논문 그림 후보 선택 전까지 기존 SVG 개념도를 유지합니다. 출처와 교체 기록은 [Research 원문 검증](docs/Research-원문검증.json), [대표 그림 원본 교체 기록](docs/Research-대표그림-원본교체.json), [연구 그림 설명](docs/연구그림-설명.md), [이미지 출처](docs/이미지-출처.md)에 있습니다.

## 논문 목록

게재 논문은 총 46편이며, 최신 논문부터 표시하고 번호는 각 연도 묶음에서 다시 1번부터 매깁니다. 심사 중 원고는 **Under review**에 별도로 표시하며 게재 논문 수와 검색·연도 필터에 포함하지 않습니다. 연구실 저자는 풀네임으로 표기하고 굵게·밑줄로 구분합니다.

46편 중 45편에는 실제 graphical abstract 또는 구조 그림이 있습니다. PC에서는 서지정보 왼쪽, 모바일에서는 위에 표시하며 누르면 전체 그림과 출처를 볼 수 있습니다. 2014년 JNN 논문 `pub-40`은 공개 그림을 확인하지 못해 비워 두었습니다. 해당 논문의 저자 원본 PDF가 있으면 추가할 수 있습니다. 출처·그림 번호·치수·해시는 [논문 그림 출처](docs/논문그림-출처.json)에 보관합니다.

## GitHub에서 처음 게시하기

1. 저장소 `SogangQMPL/sogangqmpl.github.io`의 기본 브랜치는 `main`을 사용합니다.
2. **이 폴더의 내용**을 저장소 루트에 올립니다. `package.json`, `template.html`, `content`, `assets`, `admin`, `scripts`, `.github/workflows/pages.yml`이 포함되어야 합니다. `.github`는 숨김 폴더일 수 있습니다. `dist`는 빌드 결과이므로 올리지 않습니다.
3. 저장소 **Settings → Pages → Build and deployment → Source → GitHub Actions**를 선택합니다.
4. **Actions → Publish lab website → Run workflow**를 실행하거나 `main`에 변경을 저장합니다.
5. 완료 후 Pages 설정의 **Visit site**로 접속해 공개 주소와 PC·모바일 화면을 확인합니다. 현재 저장소는 GitHub Actions를 통해 공개 사이트에 자동 배포됩니다.

## 자료와 확인 범위

내용은 기존 공개 Wix 자료와 사용자가 제공한 수정·추가 자료를 반영합니다. 논문에는 교수님의 이전 소속 시절 연구가 포함됩니다. 서지 수정 내역은 [자료 검토 기록](docs/자료-검토.md)에 남겼습니다.

글꼴은 `assets/fonts/`에서 자체 호스팅하며 라이선스와 [출처](docs/글꼴-출처.md)를 함께 보관합니다.

최신 검증 결과는 [디자인 수정 기록](docs/디자인-수정-기록.md)에 남깁니다. [사이트 분석과 설계](docs/사이트-분석과-설계.md)의 이전 시안 검증 기록과 구분합니다.
