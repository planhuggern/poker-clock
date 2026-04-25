export const state = {
  gameState: null,
  myPlayerId: null,
  selectedTerritory: null,
  missionRevealed: false,
  ws: null,
  svgEl: null,
  mapTransform: { x: 0, y: 0, scale: 1 },
  panState: {
    active: false, hasMoved: false,
    startX: 0, startY: 0, lastX: 0, lastY: 0,
    startTx: 0, startTy: 0,
  },
};
