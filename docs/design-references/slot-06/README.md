# 06 모델 슬롯 실험

기존 06 슬롯의 선택·확인·취소와 입력창 너비/높이 모션을 보존한 실행 데모다.
`FluidComposerBody`, `FluidComposerPicker`, `AttachmentPreview`와 제품 CSS를 직접 불러온다.
SDK 연결만 합성 공급자·모델·선택 상태로 대체하며 실제 메시지와 API 요청은 보내지 않는다.

```sh
node docs/design-references/slot-06/build.mjs /tmp/composer-slot-demo
```

출력된 `index.html`, `app.js`, `LICENSES.txt`를 같은 폴더에서 HTTP로 서비스한다.
디자인은 자체 제작이며 React는 실행 기반 도구다. 실제 iPhone 키보드와 BB의 음성/전송 검증을 대신하지 않는다.

제품에서는 Composer 설정 `experimentalSlotPicker`가 false인 것이 기본이다.
실험을 켜면 기존 `06 슬롯` 비교 토글이 나타난다. 데모는 비교를 위해 실험 설정이 켜져 있다.
