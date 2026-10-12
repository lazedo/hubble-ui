import { Filters, FilterEntry, filterFlow, filterServiceByEntry } from '~/domain/filtering';
import { Flow } from '~/domain/flows';
import { HubbleService } from '~/domain/hubble';
import { ProtoFactory } from '~/factories/proto';

import { flows, services } from '~/testing/data';

const nameLabel = 'k8s:app.kubernetes.io/name=api';

// A flow observed in the far cluster of the mesh: hubble knows the remote
// endpoint's identity labels, but has no workload for it.
const remoteSender = (appName: string): Flow =>
  new Flow({
    ...flows.hubbleOne,
    source: {
      ...flows.hubbleOne.source!,
      labels: [`k8s:app.kubernetes.io/name=${appName}`, 'k8s:io.cilium.k8s.policy.cluster=east'],
      workloads: [],
    },
  });

const api = FilterEntry.newWorkload({ kind: 'StatefulSet', name: 'api' });

describe('workload filter across a cluster mesh', () => {
  test('matches a remote sender by its name label', () => {
    const filters = Filters.fromObject({ filters: [api] });

    expect(filterFlow(remoteSender('api'), filters)).toBe(true);
    expect(filterFlow(remoteSender('callflow'), filters)).toBe(false);
  });

  test('matches a card without workloads by its name label', () => {
    const remote: HubbleService = {
      ...services.regular,
      labels: [{ key: 'k8s:app.kubernetes.io/name', value: 'api' }],
      workloads: [],
    };
    const other: HubbleService = {
      ...remote,
      labels: [{ key: 'k8s:app.kubernetes.io/name', value: 'callflow' }],
    };

    expect(filterServiceByEntry(remote, api)).toBe(true);
    expect(filterServiceByEntry(other, api)).toBe(false);
  });

  test('every workload relay filter has a name-label twin', () => {
    const [wl] = ProtoFactory.flowFiltersFromFilters(Filters.fromObject({ filters: [api] }));

    const byWorkload = wl.filter(f => f.sourceWorkload.length + f.destinationWorkload.length > 0);
    const byLabel = wl.filter(
      f => f.sourceLabel.includes(nameLabel) || f.destinationLabel.includes(nameLabel),
    );

    expect(byWorkload).toHaveLength(4);
    expect(byLabel).toHaveLength(4);
    byLabel.forEach(f => {
      expect(f.sourceWorkload).toEqual([]);
      expect(f.destinationWorkload).toEqual([]);
    });
  });
});
