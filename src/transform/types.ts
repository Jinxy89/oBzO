import type { Annotation } from "../model/types";
import type { ColorRole, ColorRule } from "../model/color";

export interface HighlightGroup {
  label: string;
  role: ColorRole | "unsorted";
  annotations: Annotation[];
}

export interface RenderContext {
  colorMap: ColorRule[];
  unsortedLabel: string;
  themePrefix: string;
  collectionNameById: Map<number, string>;
  titleByKey: Map<string, string>;
  existingStatus?: string;
}
