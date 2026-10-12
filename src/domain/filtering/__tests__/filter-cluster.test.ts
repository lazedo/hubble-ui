import { Filters, FilterEntry, FilterKind, FilterDirection, filterFlow } from '~/domain/filtering';
import { Flow } from '~/domain/flows';
import { ProtoFactory } from '~/factories/proto';

import { flows } from '~/testing/data';

const flowOn = (nodeName: string): Flow => new Flow({ ...flows.hubbleOne, nodeName });

describe('cluster filter entry', () => {
  test('parses cluster=west', () => {
    const e = FilterEntry.parse('cluster=west')!;

    expect(e.kind).toBe(FilterKind.Cluster);
    expect(e.query).toBe('west');
    expect(e.negative).toBe(false);
    expect(e.direction).toBe(FilterDirection.Either);
  });

  test('parses !cluster=east', () => {
    const e = FilterEntry.parse('!cluster=east')!;

    expect(e.kind).toBe(FilterKind.Cluster);
    expect(e.query).toBe('east');
    expect(e.negative).toBe(true);
  });

  test('serializes back to string', () => {
    expect(FilterEntry.newCluster('west').toString()).toBe('either:cluster=west');
  });
});

describe('filterFlow by cluster', () => {
  const west = flowOn('west/west-w1');
  const east = flowOn('east/east-w2');
  const bare = flowOn('some-node');

  test('positive narrows to the selected cluster', () => {
    const filters = Filters.fromObject({ filters: [FilterEntry.newCluster('west')] });

    expect(filterFlow(west, filters)).toBe(true);
    expect(filterFlow(east, filters)).toBe(false);
  });

  test('multi-select is an OR between clusters', () => {
    const filters = Filters.fromObject({
      filters: [FilterEntry.newCluster('west'), FilterEntry.newCluster('east')],
    });

    expect(filterFlow(west, filters)).toBe(true);
    expect(filterFlow(east, filters)).toBe(true);
  });

  test('negative excludes the cluster', () => {
    const filters = Filters.fromObject({ filters: [FilterEntry.parse('!cluster=east')!] });

    expect(filterFlow(west, filters)).toBe(true);
    expect(filterFlow(east, filters)).toBe(false);
  });

  test('flow without cluster prefix is dropped when clusters are selected', () => {
    const filters = Filters.fromObject({ filters: [FilterEntry.newCluster('west')] });

    expect(filterFlow(bare, filters)).toBe(false);
  });

  test('combines with other entries as AND, not OR', () => {
    const filters = Filters.fromObject({
      filters: [FilterEntry.newCluster('west'), FilterEntry.parse('from:label=no=such-label')!],
    });

    // NOTE: flow is on west, but the label entry does not match -> dropped
    expect(filterFlow(west, filters)).toBe(false);
  });
});

// NOTE: api in east -> amqp in west, as the rabbit node in west observes it
const crossMesh = (srcCluster: string, dstCluster: string, nodeName: string): Flow =>
  new Flow({
    ...flows.hubbleOne,
    nodeName,
    source: {
      ...flows.hubbleOne.source!,
      labels: ['k8s:app=api', `k8s:io.cilium.k8s.policy.cluster=${srcCluster}`],
    },
    destination: {
      ...flows.hubbleOne.destination!,
      labels: ['k8s:app=amqp', `k8s:io.cilium.k8s.policy.cluster=${dstCluster}`],
    },
  });

const dirCluster = (cluster: string, dir: FilterDirection, negative = false): FilterEntry => {
  const fe = FilterEntry.newCluster(cluster).setDirection(dir);
  fe.negative = negative;

  return fe;
};

describe('filterFlow by source / destination cluster', () => {
  const eastToWest = crossMesh('east', 'west', 'west/west-w1');
  const westToWest = crossMesh('west', 'west', 'west/west-w1');
  const westToEast = crossMesh('west', 'east', 'west/west-w2');

  test('destination is the cluster of the receiving endpoint, not of the node', () => {
    const filters = Filters.fromObject({ filters: [dirCluster('west', FilterDirection.To)] });

    expect(filterFlow(eastToWest, filters)).toBe(true);
    expect(filterFlow(westToWest, filters)).toBe(true);
    expect(filterFlow(westToEast, filters)).toBe(false);
  });

  test('source is the cluster of the sending endpoint', () => {
    const filters = Filters.fromObject({ filters: [dirCluster('east', FilterDirection.From)] });

    expect(filterFlow(eastToWest, filters)).toBe(true);
    expect(filterFlow(westToWest, filters)).toBe(false);
  });

  test('source and destination entries combine as AND', () => {
    const filters = Filters.fromObject({
      filters: [dirCluster('west', FilterDirection.From), dirCluster('east', FilterDirection.To)],
    });

    expect(filterFlow(westToEast, filters)).toBe(true);
    expect(filterFlow(westToWest, filters)).toBe(false);
    expect(filterFlow(eastToWest, filters)).toBe(false);
  });

  test('a negative destination entry excludes that cluster', () => {
    const filters = Filters.fromObject({ filters: [dirCluster('west', FilterDirection.To, true)] });

    expect(filterFlow(westToEast, filters)).toBe(true);
    expect(filterFlow(eastToWest, filters)).toBe(false);
  });

  test('relay filters use the endpoint cluster fields for from/to, the node for either', () => {
    const [wl, bl] = ProtoFactory.flowFiltersFromFilters(
      Filters.fromObject({
        filters: [
          dirCluster('west', FilterDirection.To),
          FilterEntry.newCluster('central'),
          dirCluster('east', FilterDirection.From, true),
        ],
      }),
    );

    expect(wl).toHaveLength(1);
    expect(wl[0].destinationClusterName).toEqual(['west']);
    expect(wl[0].nodeName).toEqual(['central/']);
    expect(wl[0].sourceClusterName).toEqual([]);
    expect(bl.some(f => f.sourceClusterName.includes('east'))).toBe(true);
  });
});
