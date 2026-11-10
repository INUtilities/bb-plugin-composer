# 06 슬롯 컴포저 크기 전환 검수

정본 Chat UI `c80e8da369ad0d669c4785528aaebff7b521c857`을 독립 Composer 제품 커밋 `9b4340403159c362d880abe949d4eaf61cc2bb81`에 통합했다. 독립 Composer 데모는 이 제품 커밋을 표시하며, 화면 변경 액션은 검수용 콜백으로 처리한다.

## 확인한 동작

| 화면 | 여러 줄 입력 | 슬롯 열림 | 긴 모델 선택 | 슬롯 닫힘 |
|---|---:|---:|---:|---:|
| desktop Chrome 1100×850 | 750×136px | 295×48px | 307×48px | 750×136px |
| phone Chrome 390×844 | 340×140px | 312×52px | 325×52px | 340×140px |

- 너비와 높이가 320ms 감속 곡선으로 함께 바뀌며, 오른쪽 끝을 기준으로 접힌다.
- 선택한 모델과 Effort의 이름이 필요한 너비를 확보한다. 280px phone에서는 화면 안의 230×52px로 제한하고 확인 버튼을 화면 안에 둔다.
- 설정을 닫은 뒤 같은 편집 DOM과 여러 줄 초안, 원래 컴포저 크기가 복원된다. 설정을 여닫는 동안 메시지를 보내지 않았다.
- 동작 줄이기 설정에서는 너비 전환을 즉시 끝낸다. 제품 코드에는 새 전역 관찰자나 반복 프레임 루프가 없다.

## 캡처

- desktop: [열기 전](desktop-slot-before.png) · [열림](desktop-slot-compact.png) · [닫은 뒤](desktop-slot-restored.png)
- phone: [열기 전](phone-slot-before.png) · [열림](phone-slot-compact.png) · [닫은 뒤](phone-slot-restored.png) · [280px 화면](phone-narrow-slot-compact.png)
- [측정값과 단언 결과](slot-compact-validation.json)

## 검사 범위

- Chat UI 정본: `npm test` 791 passed, `npm run typecheck` 통과, `bb plugin build` 통과.
- 독립 Composer: Node 30 passed, UI 279 passed / 기존 3 skipped, `npm run typecheck` 통과, `bb plugin build` 통과.
- 현재 BB의 Chat UI는 정본 경로에서 번들 `f636f8cd537f690f`를 실행한다. 별도 설치된 Composer는 이 PR 작업트리의 번들이 아니다.
- 실제 iPhone Safari, IME, 마이크, 파일 업로드, 외부 전송은 확인하지 않았다. 최종 화면 적합성은 사용자가 판정한다.
