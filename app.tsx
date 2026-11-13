export { thirdPartyComposerNotices } from "./composer/notices";
export { thirdPartyChatUiNotice } from "./lib/chat-ui-notice";
import { definePluginApp } from "@get-bb/plugin-sdk/app";
import { useInsertionEffect } from "react";
import { FluidComposer } from "./composer/FluidComposer";
import { DeviceChromeBridge } from "./lib/device-chrome";
import { injectFluidComposer } from "./lib/fluid-composer";

// 자식이 첫 높이를 재기 전에 스타일을 준비하고 선택된 컴포저 수명에만 연결한다.
export function Composer() {
  useInsertionEffect(() => injectFluidComposer(document), []);
  return <><DeviceChromeBridge /><FluidComposer /></>;
}

// 기본 컴포저 대신 사용할 공식 교체 슬롯을 등록한다.
export default definePluginApp(function registerComposer(app) {
  app.slots.experimental_composer({
    id: "composer",
    title: "Composer · Fluid Squircle",
    description: "Fluid 입력·옵션·음성 UI와 스쿼클을 쓰는 독립 컴포저",
    component: Composer,
  });
});
