import type { BbPluginApi } from "@get-bb/plugin-sdk";

// 슬롯은 기본 입력 UI와 분리된 선택적 디자인 실험이다.
export default function registerComposerServer(bb: BbPluginApi) {
  bb.settings.define({
    experimentalSlotPicker: {
      type: "boolean",
      label: "06 슬롯 실험 사용",
      default: false,
    },
  });
}
