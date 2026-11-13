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
- iPhone 앱은 PWA/WebView 기반이므로 phone의 실제 편집 영역(`contenteditable`) 글자는 16px 미만으로 줄이지 않는다. 16px 미만이면 입력 포커스 때 viewport가 확대되고 caret 위치가 어긋날 수 있다. 밀도를 조정할 때도 입력 글자 크기는 유지한다.
- `composer/`와 직접 의존하는 `lib/`는 Chat UI의 Fluid 통합 커밋에서 복사하며 출처·파일 해시는 `docs/upstream-source.json`으로 확인한다. 이전 독립 입력기와 모션은 Git 이력에 보존한다.
- 한 줄 입력은 desktop 24px·phone 26px의 반원을 유지한다. 여러 줄 입력의 실제 clip에만 지원 시 스쿼클 desktop 50.6px·phone 54.9px을 적용하며 미지원은 기존 둥근 모서리를 유지한다. 옵션 카드·원형 버튼과 Fluid의 높이·음성 전환은 원본대로 유지한다.
- 제품 스타일과 기기 bridge는 이 플러그인의 컴포저가 mount된 동안만 연결한다. 선택하지 않은 상태에서 Chat UI의 정보 줄·footer를 숨기는 전역 content script를 등록하지 않는다.
- Chat UI의 메시지·인용·목차·정보 카드 controller는 가져오지 않는다. 실제 역할 분리와 현재 선택된 컴포저의 변경은 별도 작업이다.
- 입력기 변경은 독립 Composer가 소유한다. Chat UI는 원격 기반의 채팅 화면만 담당하며 실험 입력기와 Fluid 전역 스타일을 등록하지 않는다. 이전 통합 출처와 파일 해시는 docs/upstream-source.json에 보존한다.
- 데모는 제품 컴포저 코드를 직접 불러오고 합성 입력과 전송 콜백만 사용한다. 실제 메시지를 자동 전송하지 않는다.

- 모델·Effort와 06 슬롯은 같은 editor·초안·첨부 수명을 유지한다. 06 슬롯은 Composer 설정 `experimentalSlotPicker`(기본 false)를 켰을 때만 컴포저 위 토글로 기존 모드와 전환하며 설정 확인은 메시지를 보내지 않는다. 기존 모드의 한 줄 컨트롤은 오른쪽 전송·정보 버튼 왼쪽에 둔다. 실제 지원 Effort·Fast만 표시하며 공급자 변경은 공개 Composer 핸드오프를 사용한다.
- 병합 결과는 Chat UI 정본과 원격 Composer 입력 수정의 통합본이다. sourceSha256과 sha256을 구분하고 400ms 펼침·150ms 접힘·호스트 초기화 즉시 접힘·독립 옵션 필과 iPhone native Enter/beforeinput·첫 프레임·caret 보정을 함께 유지한다.


- Fluid 상단의 기존 정보 필과 `i` 메타데이터 필은 평소 항상 표시한다. `06 슬롯` 토글은 실험 설정을 켰을 때만 표시한다. 토글은 공통 navigation pill 규격을 쓰며 `i`는 기존 Project·Branch·Permission·Context를 컴포저 위의 카드로 연다. 하단에는 메타데이터나 예약 공간을 남기지 않는다. `+`는 버튼·기호의 기본 크기를 유지하고 45도 회전만 한다. 옵션을 열면 기존 상단 필을 200ms·45ms 간격으로 순차 fade out한 뒤 옵션 필이 opacity 0에서 기존 460ms droplet·45ms 간격으로 등장한다. 닫기·해제는 원래 필과 상호작용을 복원하며 reduced motion은 즉시 반영한다. 이 규칙은 이전 정보 숨김·기호 길이 확대·pressPop 규칙을 대체한다.


- 임시 배치에서 `06 슬롯`과 `i`는 Code·Child·Parent 등 기존 정보 필과 같은 정보 행 안에 연결한다. 정보 행이 없거나 숨겨졌을 때만 컴포저 위의 원래 자리를 쓴다. 같은 460ms·45ms droplet을 사용하고 기존 정보 행은 두 필의 폭을 예약해 겹침을 막는다. 관찰은 해당 컴포저의 정보 행 생성·교체·숨김에만 반응하며 전역 관찰자·반복 frame loop를 추가하지 않는다.


- 기존 표시 모드의 Effort는 한 줄일 때 아이콘만 표시한다. 클릭해 확정한 이름은 기존 글자 전환으로 1.5초간 보인 뒤 다시 접으며 연속 선택은 표시 시간을 갱신한다. 여러 줄은 이름을 계속 표시한다. 접힘 배치는 아이콘 폭으로 판단해 이름 표시가 줄바꿈 경계의 여러 줄 상태를 고정하지 않게 하며 직접 줄바꿈은 유지한다. 화면·모델·잠금 변경과 해제는 예약을 정리하고 전체 이름은 접근성 이름에 유지한다. 새 관찰자·반복 frame loop는 쓰지 않는다.

- 06 슬롯 설정을 열면 컴포저는 기존 입력의 너비·높이와 관계없이 선택한 공급자·모델·Effort와 확인 버튼에 필요한 너비, desktop 48px·phone 52px의 한 줄 높이로 320ms kit 감속 전환한다. 가로 가운데를 고정하고 지원 목록이 로딩 중이면 상태 문구의 폭도 확보한다. editor·초안·첨부는 같은 노드에 보존하며 설정을 닫으면 원래 너비·높이와 여러 줄 모양으로 돌아간다. 휠은 transform된 컴포저를 기준으로 fixed overlay에 그려 WebKit에서 overflow-clip-margin 없이 위·아래가 보이게 한다. 다섯 행을 화면 안에 배치하며 닫힌 목록과 휠의 아래쪽은 부모 스크롤 범위를 늘리지 않는다. reduced motion은 즉시 반영한다. 이 규칙은 위의 슬롯 열림 시 입력창 높이·모서리를 유지한다는 규칙을 대체한다.

- `+` 옵션 목록은 컴포저 위에 겹쳐 표시해 기존 정보 필과 입력창을 밀지 않는다. 기존 필은 제자리에서 순차 fade out한 뒤 옵션을 표시한다. `×`로 닫으면 옵션을 200ms·45ms 간격으로 fade out하고 마지막 퇴장이 끝난 뒤 기존 필과 상호작용을 복원한다. 닫히는 목록은 inert로 두며 빠른 재열림·해제·reduced motion은 예약과 모션을 정리한다.

- phone·desktop 모두 일반 입력·슬롯·음성 모드에서 컴포저 바깥에 별도의 하단 배경이나 블러를 깔지 않는다. 입력창 자체의 표면과 높이·위치·모션은 유지한다.

- Effort는 선택한 모델이 공개 SDK로 제공한 전체 목록을 순서대로 표시한다. `default`·`none`·`minimal`을 포함한 단계 아이콘은 서로 구분하고, 긴 모델명보다 Effort 이름·아이콘 폭을 먼저 확보한다. 모델의 `reasoningDiscovery`가 `unknown`이면 선택 시 `selectedModel`로 상세 목록을 읽고 같은 컴포저 범위에서 재사용한다. 지원 목록에 없는 단계를 추측해 추가하지 않는다. 입력 안의 모델 변경 버튼은 기존 모드·06 슬롯과 phone·desktop 모두 hover·눌림·열림에서 배경을 만들지 않으며 키보드 focus 표시는 유지한다.

- 정보 필과 `i`는 기존 컴포저 위 카드에서 정보를 연다. 정보 표시를 위해 입력창의 크기·모양을 바꾸거나 편집 노드를 숨기지 않는다. `+` 옵션 필의 아래쪽 간격은 기존 정보 필과 같은 8px로 유지한다.
