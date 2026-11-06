<!-- bb-plugin-kit:common begin — 자동 복사본이다. 여기서 고치지 말고
     ~/Foundry/bb-plugin/bb-plugin-kit/AGENTS.common.md를 고친 뒤 다시 복사한다. -->
## BB 플러그인 공통 규칙

이 저장소는 BB 플러그인이다. 아래 규칙은 `~/Foundry/bb-plugin` 아래 모든 플러그인에 같다.

1. **BB 앱은 고치지 않는다.** 이 저장소 안에서만 고친다. `~/Foundry/bb`(BB 앱 소스)와
   설치된 BB 앱 파일에는 쓰지 않는다. 플러그인으로 안 되는 일이면 멈추고 그렇다고 보고한다.
2. **폰이냐 컴퓨터냐는 `device`로 정한다.** 창 너비(`viewport`)는 화면을 얼마나 빽빽하게
   채울지에만 쓴다. 판정 코드는 kit에서 복사한 `useDeviceChrome()`만 쓰고, 복사본
   (`device.ts`, `use-device.ts`)은 고치지 않는다.
3. **검색은 검색어가 연속으로 들어 있는 것만 맞춘다.** 대소문자는 무시하고, 맞은 부분은
   진하게 표시한다. 흩어진 글자를 맞추는 fuzzy 검색은 쓰지 않는다.
4. **플러그인 전체 화면(navPanel)은 다른 스레드에 갔다 와도 보던 폴더·선택·보기를 그대로
   보여 준다.** BB를 껐다 켜면 처음 화면으로 돌아간다. 그래서 이 상태는 `sessionStorage`나
   모듈 변수에 두고, `localStorage`나 plugin settings에 두지 않는다.
5. **화면이 맞는지는 사용자가 판정한다.** 테스트가 초록이어도 화면 완료를 선언하지 않는다.
   완료 보고에는 네 가지를 적는다. 검증한 커밋, 지금 실행 중인 번들이 그 커밋인지,
   phone·desktop 캡처(없으면 없다고), 확인하지 못한 것.
6. **커밋과 브랜치.** 검증된 기능 단위마다 묻지 않고 커밋한다. push는 사용자가
   「푸시해」라고 할 때만 한다. 일이 끝나면 main에 머지하고, 머지된 브랜치와 워크트리를
   정리한다. 커밋 메시지는 commit-msg hook이 검사한다. `--no-verify`로 hook을 건너뛰지 않는다.
7. **디자인은 kit의 디자인 문서를 따른다.** UI를 만들거나 고치기 전에
   `~/Foundry/bb-plugin/bb-plugin-kit/docs/design.md`를 읽는다. 색은 BB 테마 토큰만 쓰고
   색값(`#hex`, `oklch(...)`)을 직접 넣지 않는다. 모션은 kit의 `motion/`을 복사해 쓴다.

### 이럴 때 kit 문서를 읽는다

- UI를 만들거나 고칠 때: `~/Foundry/bb-plugin/bb-plugin-kit/docs/design.md`
- 새 플러그인을 만들 때: `~/Foundry/bb-plugin/bb-plugin-kit/docs/new-plugin.md`
- 설치 위치를 옮기거나 git·npm 설치를 path로 바꿀 때, 화면에 옛 번들이 보일 때:
  `~/Foundry/bb-plugin/bb-plugin-kit/docs/install.md`
- 기기 판정을 바꾸거나 헬퍼를 다시 복사할 때: `~/Foundry/bb-plugin/bb-plugin-kit/docs/device.md`

### 규칙과 강제 장치

글로만 지키는 규칙은 어겨도 아무것도 실패하지 않는다. 장치를 하나 붙일 때마다 이 표를 고친다.
이 블록이 원본과 같은지는 kit에서 `npm run check-agents`로 검사한다.

| 규칙 | 지금 막는 장치 |
|---|---|
| 1 BB 앱 | 없음 (예정: `~/Foundry/bb` 쓰기 차단) |
| 2 기기 | 없음 (예정: 복사본 해시 검사) |
| 3 검색 | 없음 (예정: 공유 검색 모듈과 테스트) |
| 4 navPanel | 없음 |
| 5 화면 | 없음 (예정: `verify-bb-plugin`) |
| 6 커밋 | commit-msg hook: 형식·tag·명사 끝 검사. 원본 `~/Systems/registry-pool/scripts/git-hooks`, 연결은 kit `npm run sync-agents` |
| 7 디자인 | 없음 (예정: 직접 넣은 색값 검사, 모션 복사본 해시 검사) |
<!-- bb-plugin-kit:common end -->

## 이 플러그인만의 규칙

- plugin id: `composer`
- 확인 명령: `npm run typecheck`, `npm test`
- 이 플러그인의 제품 규칙은 이 절에 쓴다.
- 공식 `experimental_composer` 슬롯으로 입력 상자 전체를 교체한다. BB 앱과 기존 Chat UI는 수정하지 않는다.
- `composer/`와 직접 의존하는 `lib/`는 Chat UI의 Fluid 통합 커밋에서 복사하며 출처·파일 해시는 `docs/upstream-source.json`으로 확인한다. 이전 독립 입력기와 모션은 Git 이력에 보존한다.
- 입력 스쿼클은 지원 시 desktop 50.6px·phone 54.9px이며, 미지원은 24px·26px을 유지한다. 옵션 카드·원형 버튼과 Fluid의 높이·음성 전환은 원본대로 유지한다.
- 제품 스타일과 기기 bridge는 이 플러그인의 컴포저가 mount된 동안만 연결한다. 선택하지 않은 상태에서 Chat UI의 정보 줄·footer를 숨기는 전역 content script를 등록하지 않는다.
- Chat UI의 메시지·인용·목차·정보 카드 controller는 가져오지 않는다. 실제 역할 분리와 현재 선택된 컴포저의 변경은 별도 작업이다.
- 실제 분리 전의 입력기 변경 정본은 bb-chat-ui이며, 이 저장소의 제품 사본을 독자적으로 변경하지 않는다. 동기화할 때 출처·파일 해시를 함께 갱신한다.
- 데모는 제품 컴포저 코드를 직접 불러오고 합성 입력과 전송 콜백만 사용한다. 실제 메시지를 자동 전송하지 않는다.
