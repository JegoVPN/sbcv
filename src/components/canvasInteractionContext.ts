import { createContext, useContext } from "react";

export type CanvasInteractionValue = {
  pendingPortKey: string | null;
  compatiblePortKeys: ReadonlySet<string>;
  disconnectPort: (nodeId: string, handleId: string) => void;
};

export const EMPTY_COMPATIBLE_PORT_KEYS = new Set<string>();

export const CanvasInteractionContext = createContext<CanvasInteractionValue>({
  pendingPortKey: null,
  compatiblePortKeys: EMPTY_COMPATIBLE_PORT_KEYS,
  disconnectPort: () => {},
});

export function interactionPortKey(nodeId: string, handleId: string) {
  return `${nodeId}\u0000${handleId}`;
}

export function useCanvasInteraction() {
  return useContext(CanvasInteractionContext);
}
