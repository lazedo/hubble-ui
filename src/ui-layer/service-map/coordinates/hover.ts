import { ServiceMapArrow } from './arrow';

// NOTE: What the pointer is over on the map: an arrow (from its sender card up
// NOTE: to its connector), a connector, or an access point of a receiver card
export type ArrowsHoverTarget =
  | { kind: 'arrow'; id: string }
  | { kind: 'connector'; id: string }
  | { kind: 'accessPoint'; id: string };

// NOTE: What a hover lights up: the arrows, their connectors, the small arrows
// NOTE: from those connectors to the access points, and those access points
export type ArrowsHighlight = {
  arrows: Set<string>;
  connectors: Set<string>;
  apArrows: Set<string>;
  accessPoints: Set<string>;
};

export const emptyHighlight = (): ArrowsHighlight => ({
  arrows: new Set(),
  connectors: new Set(),
  apArrows: new Set(),
  accessPoints: new Set(),
});

export const isHighlightActive = (hl: ArrowsHighlight): boolean => hl.arrows.size > 0;

// NOTE: A whole path is a sender arrow plus its small arrows to the access
// NOTE: points: hovering any part of it lights up the paths that go through it
export const computeHighlight = (
  arrows: Map<string, ServiceMapArrow>,
  target: ArrowsHoverTarget | null,
): ArrowsHighlight => {
  const hl = emptyHighlight();
  if (target == null) return hl;

  arrows.forEach((arrow, arrowId) => {
    const isArrow = target.kind === 'arrow' && arrowId === target.id;
    const apArrows = [...arrow.accessPointArrows.entries()].filter(([, apArrow]) => {
      if (target.kind === 'arrow') return isArrow;
      if (target.kind === 'connector') return apArrow.connectorId === target.id;

      return apArrow.accessPointId === target.id;
    });
    if (!isArrow && apArrows.length === 0) return;

    hl.arrows.add(arrowId);
    apArrows.forEach(([apArrowId, apArrow]) => {
      hl.apArrows.add(apArrowId);
      if (apArrow.connectorId != null) hl.connectors.add(apArrow.connectorId);
      if (apArrow.accessPointId != null) hl.accessPoints.add(apArrow.accessPointId);
    });
  });

  return hl;
};
