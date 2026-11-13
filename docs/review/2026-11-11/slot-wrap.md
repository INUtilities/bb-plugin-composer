# 슬롯 잘림·입력 높이 재현

기준은 로컬 main `d7b5b89`다. 음성·iPhone Enter 처리·모델 선택 확정 방식·PR 모션 시간은 유지했다.

## 슬롯

실제 BB의 별도 WebKit에서 `overflow-clip-margin:120px` 미지원과 카드 밖 위·아래 항목의 hit-test 실패를 재현했다. Chrome에서도 phone 목록 아래가 화면 밖으로 32px 나가는 경우를 확인했다.

transform된 form을 containing block으로 쓰는 fixed overlay와 visible overflow로 바꿔 해당 속성 의존을 없앴다. 컴포저 이동량은 두 행으로 확보해 다섯 행을 화면 안으로 옮겼다. 실제 BB WebKit의 phone·desktop에서 선택 항목 위·아래 두 행까지 모두 클릭 가능하며, 닫은 뒤 부모 scrollHeight가 기존 값으로 복구됨을 확인했다.

## 높이

실제 BB Chrome의 phone 조합 입력에서 내부 여러 줄 배치는 92px인데 외부 목표 높이는 다음 frame까지 52px인 순간을 기록했다. 두 독립 실행에서 약 15~20ms 간격이었다. rAF는 paint 전이므로 이 샘플만으로 실제 화면이 한 프레임 접힌 채 그려졌다고 단정하지 않는다. 높이 적용 순서를 앞당기는 보정이며 사용자 현상의 원인을 확정한 것은 아니다. 더 오래 한 줄 높이에 머무는 사용자 현상과 동일한 원인이라고 확정하지 않는다. Chromium·WebKit의 일반 입력에서 장시간 접힘을 재현하지 못했다.

동일한 높이 controller에 sync를 제공하고 multiline commit의 layout effect에서 호출한다. 뒤따른 ResizeObserver도 같은 상태를 사용하므로 별도 타이머·새 관찰자·지속 frame loop를 추가하지 않는다. 400ms 펼침·150ms 줄 변화와 기존 커서·IME 코드는 유지한다.

ResizeObserver가 늦게 오는 테스트는 수정 전 목표 높이 52px로 실패하고 수정 후 116px로 통과한다. 뒤따른 callback이 상태를 되돌리거나 모션을 재시작하지 않는 것도 확인한다. 전체 테스트·typecheck·build와 실제 적용 후 결과는 작업 thread storage에 기록한다. 테스트 SDK host의 프레임 기록은 실제 BB와 수명이 달라 baseline에서도 지연이 없어, 해당 기록을 실제 재현 증거로 확대하지 않는다.

실제 iPhone 키보드·viewport 및 사용자의 시각 판정은 별도 확인이 필요하다.
