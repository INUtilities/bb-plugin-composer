---
name: composer
description: 독립 Composer 플러그인의 화면과 입력 기능을 수정하고 검증한다.
---

# Composer

공식 `app.slots.experimental_composer` 교체 슬롯을 사용한다.
Fluid 화면은 `composer/`와 `lib/fluid-composer.ts`, 입력 기능은 `composer/src/PromptBoxInternal.tsx`에 있다.
복사 기준과 파일별 해시는 `docs/upstream-source.json`, 엔진 원본은 `composer/UPSTREAM.json`에서 확인한다.
BB 앱과 설치 파일은 수정하지 않는다. 초안·첨부·전송 상태는 공개 SDK를 통해 BB에 맡긴다.
기기 판정은 수정하지 않은 kit 복사본 `useDeviceChrome()`을 쓴다.
스타일과 기기 bridge는 컴포저 mount에 연결하며 선택하지 않은 상태의 전역 content script를 추가하지 않는다.
확인 명령은 `npm run typecheck`, `npm test`, `bb plugin build .`이다.
사용자가 디자인을 확인하기 전에는 시각 동등성이 입증됐다고 보고하지 않는다.
