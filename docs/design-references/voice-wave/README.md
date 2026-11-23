# Composer 음성 파형 데모

이 데모는 제품의 유리 표면, 음성 버튼, 파형 렌더러를 불러온다. 브라우저에서 만든 합성 음성으로 막대의 높낮이와 빛을 확인할 수 있다.

```sh
node docs/design-references/voice-wave/build.mjs ./dist/voice-wave-demo
```

생성된 `dist/voice-wave-demo/index.html`을 Chrome에서 연다. 마이크를 탭하면 원형 정지 버튼이 분리된다. 정지 버튼을 누르면 입력창에 예시 전사문이 들어간다. 마이크를 길게 누르면 손을 뗄 때 같은 동작으로 돌아온다. 입력창에 글이 있으면 종이비행기 버튼이 표시된다.

데모의 마이크, 전사, 전송은 브라우저 안에서 모의로 실행된다.
