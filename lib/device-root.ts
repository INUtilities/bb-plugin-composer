import type { DeviceChrome } from './device.ts';

const axes = ['device', 'orientation', 'viewport', 'hitTarget'] as const;
const attributes = ['data-bb-chat-ui-root-device', 'data-bb-chat-ui-root-orientation',
  'data-bb-chat-ui-root-viewport', 'data-bb-chat-ui-root-hit-target'] as const;
type RootState = { owners: Map<symbol, DeviceChrome>; original: (string | null)[] };
const roots = new WeakMap<Document, RootState>();

// 같은 창의 여러 컴포저가 공유한다. 공용 헬퍼의 판정값만 전달하고 새 판정은 하지 않는다.
export function mountDeviceRoot(document: Document, initial: DeviceChrome) {
  const root = document.documentElement;
  let state = roots.get(document);
  if (!state) {
    state = { owners: new Map(), original: attributes.map(attr => root.getAttribute(attr)) };
    roots.set(document, state);
  }
  const current = state;
  const owner = Symbol();
  let disposed = false;
  const publish = (snapshot: DeviceChrome) => {
    axes.forEach((axis, index) => {
      const value = snapshot[axis];
      if (root.getAttribute(attributes[index]) !== value) root.setAttribute(attributes[index], value);
    });
  };
  const update = (snapshot: DeviceChrome) => {
    if (disposed) return;
    current.owners.set(owner, snapshot);
    publish(snapshot);
  };
  update(initial);
  return { update, dispose() {
    if (disposed) return;
    disposed = true;
    current.owners.delete(owner);
    // 스레드 교체의 같은 commit 안에서 bridge가 다시 붙으면 마지막 값을 유지한다.
    queueMicrotask(() => {
      if (current.owners.size || roots.get(document) !== current) return;
      attributes.forEach((attr, index) => {
        const value = current.original[index];
        if (value === null) root.removeAttribute(attr); else root.setAttribute(attr, value);
      });
      roots.delete(document);
    });
  } };
}
