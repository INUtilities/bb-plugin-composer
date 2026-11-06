# Composer

BB 컴포저 전체를 공식 `experimental_composer` 슬롯으로 교체하는 별도 플러그인이다.
기본 입력기의 편집·멘션·첨부·음성·전송 연결을 가져오고 현재 Chat UI의 frost 디자인을 유지한다.
BB 앱 파일과 기존 Chat UI 플러그인은 수정하지 않는다.

## 디자인

- 펼친 입력 상자: 기존 22px, CSS 스쿼클 지원 시 46.4px(22 × 2.11 반올림).
- 미지원 브라우저: 기존 22px 둥근 모서리.
- 접힌 한 줄 입력 상자: 기존 25px 둥근 pill 유지.
- 접힘·펼침: 높이와 모서리 반경·곡선을 240ms 동안 함께 전환하며, 동작 줄이기 설정에서는 전환하지 않는다.
- 글자·도구·전송·초안·업로드는 기본 컴포저 기능을 유지한다.
- CSS 스쿼클은 Apple continuous corner의 정확한 복제가 아니다.

## 설치와 선택

`npm install`, `npm run typecheck`, `npm test`, `bb plugin build .`로 확인한다.
`bb plugin install path:<이 폴더의 절대 경로> --yes`로 설치한다.
Settings → Appearance → Composer에서 `Composer · Frost Squircle`을 고를 수 있다.
기본 Composer를 다시 고르면 원래 입력기로 돌아간다.

## 원본과 작업 범위

`src/`와 `vendor/shared/`는 BB `desktop-v0.48.1`의 필요한 소스만 복사한 것이다.
출처와 원본 SHA는 `docs/upstream-source.json`에 있다. MIT 라이선스를 보존한다.
로컬 디자인은 `app.tsx`와 `lib/composer-skin.css`에 둔다.
기기 판정은 kit의 수정하지 않은 `lib/device.ts`, `lib/use-device.ts`를 쓴다.
새 스레드에서 디자인과 동작을 계속 검수한다. 실제 phone·IME·음성·업로드·모든 메뉴의 검수는 별도로 필요하다.
