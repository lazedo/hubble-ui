import { Filters, FilterEntry, FilterKind, FilterDirection, filterFlow } from '~/domain/filtering';
import { Flow } from '~/domain/flows';

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
