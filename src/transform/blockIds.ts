import type { Annotation } from "../model/types";

export function highlightBlockId(annotation: Annotation): string {
  return `h-${annotation.key}`;
}
