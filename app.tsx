import {
  definePluginApp,
  experimental_useComposerRenderer as useComposerRenderer,
} from "@get-bb/plugin-sdk/app";
import { useDeviceChrome } from "./lib/use-device.ts";
import { PromptBoxInternal } from "./src/PromptBoxInternal";
import "./src/composer.css";
import "./lib/composer-skin.css";

// BB가 관리하는 초안과 동작을 현재 디자인의 독립 컴포저로 그린다.
export function Composer() {
  const { input, view } = useComposerRenderer();
  const chrome = useDeviceChrome();
  return (
    <div
      className="bb-independent-composer"
      data-bb-composer-device={chrome.device}
      data-bb-composer-layout={view.layout}
    >
      <PromptBoxInternal {...input} />
    </div>
  );
}

// 기본 컴포저 대신 사용할 공식 교체 슬롯을 등록한다.
export default definePluginApp(function registerComposer(app) {
  app.slots.experimental_composer({
    id: "composer",
    title: "Composer · Frost Squircle",
    description: "현재 Chat UI 디자인과 스쿼클 입력 상자를 쓰는 독립 컴포저",
    component: Composer,
  });
});
