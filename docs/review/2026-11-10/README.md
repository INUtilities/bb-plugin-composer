# 슬롯 클릭 전환 검수

검증한 제품 커밋: `35abfa38415fc0c0881190ebca2005d62dc1baf7`.
Chat UI 정본: `095d011c142459572b473f76ecb252818a75abfe`.

열린 슬롯에서 항목을 클릭하면 선택 위치까지 부드럽게 이동한다. 컴포저 위의 `06 슬롯` 토글 필은 유지한다. 목록 교체·닫기·재열기와 동작 줄이기는 즉시 위치를 맞춘다. 확인 전에는 호스트의 모델 선택과 메시지 전송을 실행하지 않는다.

- `npm test`: Node 28개, Composer 276개 통과. 기존 3개 건너뜀 유지.
- `npm run typecheck`, `bb plugin build .`: 통과.
- 회귀 검증: 중간 스크롤의 오선택 방지, 연속 클릭, 같은 컴포넌트에서 목록 교체, 닫기·재열기, 동작 줄이기 변경. 모션 조건을 반대로 바꾼 실험에서는 관련 테스트 2개가 실패했고 원본을 복원했다.
- 실제 제품을 사용한 Chrome desktop·phone 문맥에서 클릭 이동의 중간 프레임과 최종 정렬, 동작 줄이기, Fast·핸드오프 취소, 초안과 같은 입력 노드 보존을 확인했다. 중간 위치는 아래 JSON에 기록했다.

| 화면 | 캡처 | 이동 기록 |
|---|---|---|
| desktop | [클릭 후](desktop-click.png) | [프레임별 위치](desktop-click-motion.json) |
| phone | [클릭 후](phone-click.png) | [프레임별 위치](phone-click-motion.json) |

검수 데모는 이 커밋의 실제 등록 컴포넌트에 호스트 데이터와 외부 액션 fixture만 주입했다. 캡처 하단에 검증 커밋을 표시했다. 실제 iPhone Safari·IME·마이크·외부 전송은 확인하지 않았다. 실행 중인 BB는 독립 Composer PR 번들이 아니라 로컬 Chat UI 정본 `095d011`의 번들 `ef6f8e6d9d1dc579`이다. 화면의 최종 적합성은 사용자 검수가 필요하다.

## 상단 정보 필과 옵션 전환 추가 검수

제품 코드: 독립 Composer `513cd8489e0ed8d41e89588d1672dc373d300671`, 로컬 정본 `8d2275ddf15a800f85a9911f453e5dae3e3f49e3`.

기존 정보 필과 06 토글을 항상 위에 표시한다. 06 토글은 공통 navigation pill 규격이며 `i` 필에서 기존 메타데이터를 위쪽 카드로 연다. 하단 footer는 공간을 차지하지 않는다. `+`는 기본 크기의 회전만 사용한다. 기존 필의 순차 퇴장이 끝난 뒤 옵션이 완전히 투명한 상태에서 등장한다.

- 로컬 Node 788개, Composer 253개 통과. 독립 Composer Node 28개, Composer 277개 통과. 기존 3개 skipped 유지. 각 타입 검사와 빌드 통과.
- 조건 반전 실험에서 옵션 테스트 6개가 실패한 뒤 원본 복원. 초안·원래 모델 메뉴·음성 복귀를 유지하는 회귀 검증 통과.
- Chrome desktop·phone 문맥의 70프레임 기록으로 기존 필의 순차 퇴장과 옵션의 완전 투명 시작, 퇴장 전 옵션 노출 없음, + 버튼·기호 크기 고정, 닫기 복원과 reduced motion을 확인했다.
- 캡처는 정본의 실제 제품 컴포넌트와 정보 필 스타일을 사용한 데모다. 호스트 목록·메타데이터와 외부 액션만 fixture다. 하단 커밋 표시는 로컬 정본 `8d2275d`다. 독립 Composer에는 같은 변경을 부분 패치로 적용해 기존 iPhone 수정은 유지했다.
- 현재 BB는 정본의 번들 `c14f99f29567d14c`를 실행한다. 실제 iPhone Safari·키보드·마이크·외부 전송은 확인하지 않았다. 최종 화면 적합성은 사용자 검수 대상이다.

| 화면 | 기본 필 | 메타데이터 | 옵션 |
|---|---|---|---|
| desktop | [기본](upper-desktop-upper.png) | [i 카드](upper-desktop-metadata.png) | [옵션](upper-desktop-options.png) |
| phone | [기본](upper-phone-upper.png) | [i 카드](upper-phone-metadata.png) | [옵션](upper-phone-options.png) |

[프레임별 수치와 배치 기록](upper-validation.json)
