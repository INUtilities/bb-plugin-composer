# Composer

저장소: [INUtilities/bb-plugin-composer](https://github.com/INUtilities/bb-plugin-composer)

BB의 공식 experimental_composer 슬롯으로 입력 상자 전체를 교체하는 독립 플러그인이다.
Chat UI의 원격 experiment/fluid-composer에서 시작한 Fluid 입력·옵션·음성 UI와 승인된 스쿼클을 사용한다.
현재 Chat UI와 같은 입력 코드를 별도 저장소에 준비한 단계이며, 메시지·인용·목차·정보 카드의 실제 역할 분리는 이후 작업이다.

## 코드 기준

- 원격 기준: INUtilities/bb-chat-ui, experiment/fluid-composer, 7ad97e54c514aac6527a408305989c3996b8ff07.
- 초기 통합 기준: bb-chat-ui의 88b073be2adc0ea83c9cf9ffa11f178a1ad06a04.
- 보존한 기준 태그: `composer-baseline-2026-11-06`. 이 태그의 제품 코드 기준은 bb-chat-ui의 `3dbed839d38d6f2ac78bed6f1e9d77b3f19fae4f`다.
- 현재 main 제품 코드 기준: bb-chat-ui의 `3015ec0206ebb8bb77cad9415b49e355f7ae8486`. 출처와 파일 해시는 `docs/upstream-source.json`에 기록한다.
- composer/와 직접 필요한 lib/는 Chat UI 정본에서 동기화하고 원격 main의 iPhone 입력·첫 프레임·caret 수정을 병합했다. 파일별 SHA와 엔진 원본은 docs/upstream-source.json, composer/UPSTREAM.json으로 확인한다.
- 초기 독립 구현은 Git 이력에 보존하고, 현재 입력 코드는 Fluid로 통일한다.
- 실제 분리 전까지 변경 정본은 bb-chat-ui다. 이 저장소는 검증된 버전의 사본으로 유지하며 자동 동기화는 하지 않는다.
- Chat UI의 MIT 고지는 docs/CHAT_UI_LICENSE와 배포 번들의 thirdPartyChatUiNotice에 보존한다. 선택적 Tiptap 메뉴 패키지도 입력 엔진과 같은 3.26.0으로 고정한다.

## 동작과 모서리

한 줄 입력에서 시작해 내용이 늘면 높이를 확장한다. +는 입력창 모양을 유지한 채 상단에 옵션 필을 펼치며, 공간이 부족하면 다음 줄로 넘긴다.
옵션을 연 상태에서도 작성·전송을 유지하고 +와 ×의 기호 전환은 그대로 사용한다.
정보와 설정은 전송 왼쪽의 조절 아이콘으로 열며, 기존 정보 영역과 초안을 유지한다. 시안과 같은 SVG를 16px로 직접 그리며 Lucide ISC 원문 고지는 composer/notices.ts와 배포 번들에 보존한다.
한 줄 입력은 desktop 24px·phone 26px의 반원을 유지한다. 스쿼클 지원 시 여러 줄 입력의 실제 clip만 desktop 50.6px·phone 54.9px을 사용하며, 미지원은 기존 둥근 모서리를 유지한다.
옵션 카드와 원형 버튼, Fluid의 높이·음성 동작은 원본을 유지한다. 이 배율은 시각적 비교값이며 정확한 곡선 환산식은 아니다.
초안·첨부·전송 상태는 공개 SDK를 통해 BB가 관리한다.
큰 입력 펼침은 400ms 탄성, 접힘·이미 펼친 입력의 줄 변화는 150ms 감속으로 잇는다. 높이 상한과 글의 왼쪽 경계를 넘을 수 있는 반동은 제한한다. 음성 전환과 +·× 기호는 기존 320ms, 옵션 필 전체는 물방울 460ms·45ms 간격을 유지한다. 호스트가 초안을 비우면 즉시 접힌 입력으로 돌아온다.

## 독립 Composer의 모션 보정

텍스트·커서의 이동은 기존 Chat UI `79ab0e4`의 위치 측정, 320ms 곡선과 후속 입력
처리를 그대로 사용한다. 컴포저의 확장 높이·모서리만 120ms `EASE.out`으로 더 빨리
따라가게 한다. 높이 controller가 editor를 별도로 미는 보정은 추가하지 않는다.
전체 삭제는 높이·모서리를 같은 320ms 곡선으로 접는다. 옵션·음성 전환과
reduced motion, 기본 clip과 본문의 내부 스크롤을 유지한다.
이 부분은 사용자 요청에 따른 독립 저장소의 변경이며 가져온 원본 SHA 기록은 보존한다.

## 설치와 검증

새로 설치할 때는 고정 태그를 지정할 수 있다. BB 0.48 이상과 Plugin SDK 0.6.104 이상이 필요하다.

```sh
bb plugin install git:https://github.com/INUtilities/bb-plugin-composer.git@composer-baseline-2026-11-06
```

설치 후 `Composer · Fluid Squircle`을 선택하면 독립 입력기를 사용한다. CLI에서는 다음 명령으로 선택한다.

```sh
bb settings ui set composer.provider composer/composer
```

소스에서 검증할 때는 다음 명령을 사용한다.

npm ci, npm run typecheck, npm test, bb plugin build .으로 확인한다.
plugin id는 composer, 교체 슬롯은 composer/composer이며 UI 이름은 Composer · Fluid Squircle이다.
선택된 컴포저가 mount될 때만 스타일과 기기 bridge를 연결한다. 전역 content script는 등록하지 않는다.
설치와 입력기 선택은 별도다. Chat UI가 선택돼 있으면 별도 입력기로 자동 전환하지 않는다.

큰 paste 성능 검사 3개는 원본의 PROMPTBOX_PERF=1 조건을 유지한다.
실제 phone·IME·마이크·업로드·외부 전송과 최종 화면 판정은 별도 검수가 필요하다.

모델 선택은 입력창 안의 + 오른쪽에서 기존 host 메뉴를 연다. 옆의 Effort는 첫 활성화에만 현재 환경의 목록을 읽고 지원 단계를 순환한다. 일반 단계는 막대, Max는 별, Ultra는 광선 아이콘으로 구분한다. 대화 전환·입력에는 조회를 추가하지 않으며 초안과 첨부를 유지한다.

모델 버튼의 중복 Effort 요약은 숨기고 기존 메뉴·title·접근성을 유지한다. 별도 Effort에는 hover 배경을 두지 않으며 확정된 글자만 300ms fade·zoom과 폭 전환으로 표시한다. 연속 변경·scope 변경·해제·reduced motion에서는 해당 모션을 정리한다.

Low·Medium·High는 세 막대의 점등 수로 표시하고 Extra high는 고정된 오른쪽 칸에 긴 테마 강조색 막대를 추가한다. 막대는 폭 2.5px·빈 간격 1.75px·모서리 1px의 채운 사각형이며, 모든 단계는 20×16px 칸과 글자 앞 6px 간격을 유지한다. Effort 글자만 테마 보조색 72%로 표시한다. 미선정 None·Max·Ultra 후보 각 10개와 공식 SVG·LICENSE는 assets에 보관하며 실행 번들에는 넣지 않는다.

## 모델·Effort와 06 슬롯

기본 06 슬롯은 컴포저 위 토글로 기존 모델·Effort 표시와 전환한다. 같은 editor·초안·첨부를 유지하며, 확인 전 설정은 로컬 선택이다. 프로바이더 변경은 호스트의 핸드오프 경로를 사용하고 확인 자체는 전송하지 않는다. 지원하는 Fast는 번개 토글과 설정 버튼 표지로 표시한다. 기존 모드의 한 줄 모델·Effort는 오른쪽의 전송·정보 버튼 왼쪽에 두며 여러 줄·음성 배치는 유지한다.

[보존한 모델 설정 시안](docs/design-references/composer-model-effort/README.md)과 출처 해시는 함께 보관한다. 제품 파일은 현재 Chat UI 정본 3015ec0과 독립 Composer의 41108c7을 병합한 결과이며, 원본·결과 해시는 docs/upstream-source.json에 별도로 기록한다. 기존 독립 플러그인의 전역 규칙 우선순위와 음성 전환 보정도 유지한다.
