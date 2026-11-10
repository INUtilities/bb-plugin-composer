# 런타임 소유권

독립 Composer가 Fluid 입력기·슬롯·옵션·음성을 소유한다. Chat UI는 원격 main을 기준으로 복구한다. Composer를 선택한 동안에만 입력기 스타일과 device bridge가 mount되며, Chat UI는 Fluid 입력기나 전역 Fluid 스타일을 등록하지 않는다.

이전 입력기 정본은 로컬 Chat UI 커밋 `8c08d567600df4d781a33f10db3cc042bb9ba53e`다. 병합된 독립 Composer에는 원격의 iPhone Enter·첫 프레임·caret 보정이 유지된다. 기존 출처 파일의 해시는 `upstream-source.json`에 보존한다.

현재 Composer 선택이 `bb--composer/composer`였으므로 실험 입력기를 명시적으로 선택하기 전에는 Fluid 스타일도 실행되면 안 된다. Chat UI의 이전 전역 Fluid 등록은 이 경계를 지키지 않았다. 번들 크기 차이만으로 전체 지연의 원인을 단정하지 않는다.

슬롯의 절대 배치된 목록은 부모의 스크롤 영역을 64px 늘리는 것이 재현됐다. overlay를 clip하고 paint 여유만 남긴 뒤 desktop·phone에서 불필요한 scrollHeight와 scrollTop 증가가 사라졌다. 슬롯 축소의 가로 중심도 유지된다.
