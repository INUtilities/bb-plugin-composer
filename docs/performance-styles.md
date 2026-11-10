# 동시 Composer의 스타일 공유

2026-11-10, 기존 main `41108c7`에서 디자인·CSS·입력 엔진을 유지하고 같은 문서의 활성 Composer만 stylesheet와 mode 표식을 공유하도록 변경했다. 마지막 owner에서는 기존처럼 즉시 제거한다. timer나 지연 정리는 없다. 다른 owner가 살아 있는데 mode가 먼저 풀리는 경우와 중복 dispose도 보호한다.

## 검증

제품 등록 컴포넌트·생산용 React·합성 SDK host·5000행을 같은 foreground Chromium에서 비교했다. 각 case와 시나리오 36표본, 3×ABBA, 예열 2회/phase다. 표본 하나는 입력기 교체 3회이며 CPU는 같은 문서 안의 CDP TaskDuration 차이다.

| 경로 | 이전 중앙값 | 이후 중앙값 | 이전 p95 | 이후 p95 |
|---|---:|---:|---:|---:|
| 다른 Composer 유지 | 48.31ms | 30.06ms | 50.51ms | 35.65ms |
| 단독·같은 작업 | 49.81ms | 49.97ms | 56.76ms | 59.61ms |
| 단독·분리 작업 | 51.44ms | 51.79ms | 57.09ms | 58.09ms |

복수 Composer 경로 중앙값이 37.8% 감소했고 세 ABBA 묶음에서 모두 개선됐다. A/A 중앙값 차이는 2.4%였고 모든 경로의 long task는 0회였다. 단독 경로는 개선으로 주장하지 않으며 기존 회귀 허용 범위를 통과했다. 실제 BB 전체 전환·INP·paint 완료·실제 iPhone 체감 수치는 아니다.

Node 30개와 Vitest 235개가 통과했으며 기존 skip 3개를 유지했다. typecheck·build, Chromium·WebKit의 phone/desktop 모사에서 입력·여러 줄·옵션·접힘·동시 owner·native 복구를 확인했다. 실제 iPhone IME는 이번에 측정하지 않았다.

## 기각한 접근

- 첫 슬롯 열기 전 휠 생성을 늦추기: 변동을 넘는 차이가 없어 원복.
- 마지막 style 제거를 microtask에 늦추기: 같은 작업에서는 개선됐지만 분리 작업에서 61.57→134.72ms 및 long task 28회로 회귀해 기각.
- 지연 제거 전 style 비활성화: 회귀는 사라졌으나 주 개선도 사라져 기각.

최종 구현은 지연 제거 없이 활성 owner 공유만 사용한다. 새 디자인 PR의 나머지 변경은 포함하지 않는다.
