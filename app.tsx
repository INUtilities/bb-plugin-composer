export { thirdPartyComposerNotices } from "./composer/notices";
export { thirdPartyChatUiNotice } from "./lib/chat-ui-notice";
import { definePluginApp } from "@get-bb/plugin-sdk/app";
import { useLayoutEffect } from "react";
import { FluidComposer } from "./composer/FluidComposer";
import { DeviceChromeBridge } from "./lib/device-chrome";
import { injectFluidComposer } from "./lib/fluid-composer";

// 선택된 독립 컴포저에만 Fluid 입력기와 모서리 스타일을 연결한다.
export function Composer() {
  useLayoutEffect(() => injectFluidComposer(document), []);
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
