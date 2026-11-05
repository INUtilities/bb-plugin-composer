import type { BbPluginApi } from "@get-bb/plugin-sdk";

// 화면 전용 플러그인이므로 서버 작업을 등록하지 않는다.
export default function registerComposerServer(_bb: BbPluginApi) {}
