---
name: composer
description: 독립 Composer 플러그인의 화면과 입력 기능을 수정하고 검증한다.
---

# Composer

공식 `app.slots.experimental_composer` 교체 슬롯을 사용한다.
현재 디자인은 `lib/composer-skin.css`에 있으며 입력 기능은 `src/PromptBoxInternal.tsx`에 있다.
BB 앱과 설치 파일은 수정하지 않는다. 초안·첨부·전송 상태는 공개 SDK를 통해 BB에 맡긴다.
기기 판정은 수정하지 않은 kit 복사본 `useDeviceChrome()`을 쓴다.
확인 명령은 `npm run typecheck`, `npm test`, `bb plugin build .`이다.
사용자가 디자인을 확인하기 전에는 시각 동등성이 입증됐다고 보고하지 않는다.
