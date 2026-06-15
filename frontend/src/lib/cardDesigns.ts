// Vault card designs — cosmetic only (NOT tied to risk tier). Users pick one
// in /account; the selection persists via useCardDesign. Each design maps to a
// front/back texture exported to /public/cards (see scripts that build them).

export type CardColor = "blue" | "green" | "yellow" | "black";
export type CardPattern = "topo" | "coral" | "wave";

export interface CardDesign {
  id: string;
  color: CardColor;
  pattern: CardPattern;
  label: string;
}

const COLOR_LABEL: Record<CardColor, string> = {
  blue: "Ocean",
  green: "Forest",
  yellow: "Gold",
  black: "Onyx",
};
const PATTERN_LABEL: Record<CardPattern, string> = {
  topo: "Contour",
  coral: "Coral",
  wave: "Wave",
};

export const CARD_DESIGNS: CardDesign[] = [
  ...(["blue", "green", "yellow"] as CardColor[]).flatMap((color) =>
    (["topo", "coral", "wave"] as CardPattern[]).map((pattern) => ({
      id: `${color}-${pattern}`,
      color,
      pattern,
      label: `${COLOR_LABEL[color]} ${PATTERN_LABEL[pattern]}`,
    })),
  ),
  { id: "black", color: "black", pattern: "topo", label: "Onyx" },
];

export const DEFAULT_DESIGN = "blue-topo";

export function isValidDesign(id: string | null | undefined): id is string {
  return !!id && CARD_DESIGNS.some((d) => d.id === id);
}

export const frontSrc = (id: string) => `/cards/${id}-front.webp`;
export const backSrc = (id: string) => `/cards/${id}-back.webp`;
