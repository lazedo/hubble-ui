import { Direction, FilterEntry } from './filter-entry';

// NOTE: Cluster entries narrow the whole view: AND between directions, OR
// NOTE: between the clusters of one direction. Either is the cluster that
// NOTE: observed the flow (the node name); from/to is the cluster of the
// NOTE: source/destination endpoint, which is what tells apart the two ends
// NOTE: of a flow that crosses the mesh. `clusterOf` gives the cluster for a
// NOTE: direction, or undefined when that direction does not apply (a link
// NOTE: knows nothing about nodes).
export const passesClusterEntries = (
  entries: FilterEntry[],
  clusterOf: (dir: Direction) => string | null | undefined,
): boolean => {
  for (const dir of [Direction.Either, Direction.From, Direction.To]) {
    const group = entries.filter(f => f.isCluster && f.direction === dir);
    if (group.length === 0) continue;

    const cluster = clusterOf(dir);
    if (cluster === undefined) continue;

    const positive = group.filter(f => !f.negative).map(f => f.query);
    const negative = group.filter(f => f.negative).map(f => f.query);

    if (positive.length > 0 && (cluster == null || !positive.includes(cluster))) return false;
    if (negative.length > 0 && cluster != null && negative.includes(cluster)) return false;
  }

  return true;
};
