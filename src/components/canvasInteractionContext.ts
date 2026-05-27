import { createContext, useContext, useMemo, useSyncExternalStore } from "react";

export type CanvasInteractionSnapshot = {
  pendingPortKey: string | null;
  compatiblePortKeys: ReadonlySet<string>;
};

export type CanvasInteractionStore = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => CanvasInteractionSnapshot;
  setSnapshot: (snapshot: CanvasInteractionSnapshot) => void;
  setDisconnectPort: (disconnectPort: (nodeId: string, handleId: string) => void) => void;
  disconnectPort: (nodeId: string, handleId: string) => void;
};

export const EMPTY_COMPATIBLE_PORT_KEYS = new Set<string>();
const EMPTY_SNAPSHOT: CanvasInteractionSnapshot = {
  pendingPortKey: null,
  compatiblePortKeys: EMPTY_COMPATIBLE_PORT_KEYS,
};

function createNoopStore(): CanvasInteractionStore {
  return {
    subscribe: () => () => {},
    getSnapshot: () => EMPTY_SNAPSHOT,
    setSnapshot: () => {},
    setDisconnectPort: () => {},
    disconnectPort: () => {},
  };
}

export function createCanvasInteractionStore(): CanvasInteractionStore {
  let snapshot = EMPTY_SNAPSHOT;
  let disconnectPort = (_nodeId: string, _handleId: string) => {};
  const listeners = new Set<() => void>();

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    setSnapshot: (nextSnapshot) => {
      if (
        nextSnapshot.pendingPortKey === snapshot.pendingPortKey &&
        nextSnapshot.compatiblePortKeys === snapshot.compatiblePortKeys
      ) {
        return;
      }
      snapshot = nextSnapshot;
      for (const listener of listeners) listener();
    },
    setDisconnectPort: (nextDisconnectPort) => {
      disconnectPort = nextDisconnectPort;
    },
    disconnectPort: (nodeId, handleId) => disconnectPort(nodeId, handleId),
  };
}

export const CanvasInteractionContext = createContext<CanvasInteractionStore>(createNoopStore());

export function interactionPortKey(nodeId: string, handleId: string) {
  return `${nodeId}\u0000${handleId}`;
}

export function useCanvasInteraction(nodeId: string, portKeys: string[]) {
  const store = useContext(CanvasInteractionContext);
  const key = useSyncExternalStore(
    store.subscribe,
    () => {
      const snapshot = store.getSnapshot();
      const pending = portKeys.find((portKey) => snapshot.pendingPortKey === interactionPortKey(nodeId, portKey)) ?? "";
      const compatible = portKeys
        .filter((portKey) => snapshot.compatiblePortKeys.has(interactionPortKey(nodeId, portKey)))
        .join("\u0001");
      return `${pending}\u0002${compatible}`;
    },
    () => "\u0002",
  );

  return useMemo(() => {
    const [pending = "", compatible = ""] = key.split("\u0002");
    return {
      pendingPortKey: pending || null,
      compatiblePortKeys: new Set(compatible ? compatible.split("\u0001") : []),
      disconnectPort: store.disconnectPort,
    };
  }, [key, store]);
}
