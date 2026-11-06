# Composer

BB의 공식 experimental_composer 슬롯으로 입력 상자 전체를 교체하는 독립 플러그인이다.
Chat UI의 원격 experiment/fluid-composer에서 시작한 Fluid 입력·옵션·음성 UI와 승인된 스쿼클을 사용한다.
현재 Chat UI와 같은 입력 코드를 별도 저장소에 준비한 단계이며, 메시지·인용·목차·정보 카드의 실제 역할 분리는 이후 작업이다.

## 코드 기준

- 원격 기준: INUtilities/bb-chat-ui, experiment/fluid-composer, 7ad97e54c514aac6527a408305989c3996b8ff07.
- 가져온 통합 기준: bb-chat-ui의 88b073be2adc0ea83c9cf9ffa11f178a1ad06a04.
- composer/와 직접 필요한 lib/는 수정 없이 복사했다. 파일별 SHA와 엔진 원본은 docs/upstream-source.json, composer/UPSTREAM.json으로 확인한다.
- 이전 독립 Composer와 120ms 모션은 기존 Git 이력에 보존한다. 두 입력기를 함께 유지하지 않는다.
- 실제 분리 전까지 변경 정본은 bb-chat-ui다. 이 저장소는 검증된 버전의 사본으로 유지하며 자동 동기화는 하지 않는다.
- Chat UI의 MIT 고지는 docs/CHAT_UI_LICENSE와 배포 번들의 thirdPartyChatUiNotice에 보존한다. 선택적 Tiptap 메뉴 패키지도 입력 엔진과 같은 3.26.0으로 고정한다.

## 동작과 모서리

한 줄 입력에서 시작해 내용이 늘면 높이를 확장하고, +는 같은 상자의 옵션으로 전환한다.
스쿼클 지원 시 desktop 입력은 50.6px, phone 입력은 54.9px이다. 미지원은 24px·26px을 유지한다.
옵션 카드와 원형 버튼, Fluid의 높이·음성 동작은 원본을 유지한다. 이 배율은 시각적 비교값이며 정확한 곡선 환산식은 아니다.
초안·첨부·전송 상태는 공개 SDK를 통해 BB가 관리한다.

## 설치와 검증

npm ci, npm run typecheck, npm test, bb plugin build .으로 확인한다.
plugin id는 composer, 교체 슬롯은 composer/composer이며 UI 이름은 Composer · Fluid Squircle이다.
선택된 컴포저가 mount될 때만 스타일과 기기 bridge를 연결한다. 전역 content script는 등록하지 않는다.
현재 선택된 Chat UI 컴포저는 이 코드 동기화 작업에서 변경하지 않는다. 원격 등록과 push도 별도다.

큰 paste 성능 검사 3개는 원본의 PROMPTBOX_PERF=1 조건을 유지한다.
실제 phone·IME·마이크·업로드·외부 전송과 최종 화면 판정은 별도 검수가 필요하다.
