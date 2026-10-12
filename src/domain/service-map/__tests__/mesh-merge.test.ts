import { HubbleLink, HubbleService, IPProtocol, Verdict } from '~/domain/hubble';
import { Link, ServiceCard } from '~/domain/service-map';
import { mergeMeshCards, remapLinks } from '~/domain/service-map/mesh-merge';
import { ServiceEndpoint } from '~/domain/interactions/endpoints';
import { ServiceStore } from '~/store/stores/service';

import { services } from '~/testing/data';

const workloadCard = (
  id: string,
  app: string,
  cluster: string,
  workloads: HubbleService['workloads'] = [],
): ServiceCard =>
  ServiceCard.fromService({
    ...services.regular,
    id,
    name: app,
    namespace: 'kazoo',
    identity: +id,
    workloads,
    labels: [
      { key: 'k8s:app.kubernetes.io/name', value: app },
      { key: 'k8s:io.kubernetes.pod.namespace', value: 'kazoo' },
      { key: 'k8s:io.cilium.k8s.policy.cluster', value: cluster },
    ],
  });

const worldCard = ServiceCard.fromService({
  ...services.regular,
  id: 'klab-dns-west-receiver',
  namespace: '',
  identity: 16777221,
  workloads: [],
  labels: [
    { key: 'reserved:world', value: '' },
    { key: 'cidrgroup:io.cilium.policy.cidrgroupname/klab-dns-west', value: '' },
    { key: 'cidrgroup:site', value: 'west' },
  ],
});

const link = (id: string, sourceId: string, destinationId: string, verdict: Verdict): Link =>
  Link.fromHubbleLink({
    id,
    sourceId,
    destinationId,
    destinationPort: 5672,
    ipProtocol: IPProtocol.TCP,
    verdict,
    flowAmount: 1,
    bytesTransfered: 0,
    isEncrypted: false,
  } as unknown as HubbleLink);

describe('merging cards across a cluster mesh', () => {
  const west = workloadCard('1', 'api', 'west', [{ kind: 'StatefulSet', name: 'api' }]);
  const east = workloadCard('2', 'api', 'east');
  const central = workloadCard('3', 'api', 'central');
  const amqp = workloadCard('9', 'amqp', 'west');
  west.upsertAccessPoint(new ServiceEndpoint('1', 8000, IPProtocol.TCP));
  east.upsertAccessPoint(new ServiceEndpoint('2', 8000, IPProtocol.TCP));

  const merged = mergeMeshCards([west, east, central, amqp, worldCard]);
  const api = merged.cards.find(c => c.id === 'mesh/kazoo/api')!;

  test('the same workload of three clusters is one card that lists them', () => {
    expect(merged.cards).toHaveLength(3);
    expect(api.meshClusters).toEqual(['central', 'east', 'west']);
    expect(api.caption).toBe('api');
    expect([...merged.idRemap.entries()].sort()).toEqual([
      ['1', 'mesh/kazoo/api'],
      ['2', 'mesh/kazoo/api'],
      ['3', 'mesh/kazoo/api'],
    ]);
  });

  test('a workload of one cluster and world cards stay as they are', () => {
    expect(merged.cards).toContain(amqp);
    expect(merged.cards).toContain(worldCard);
    expect(amqp.meshClusters).toBeNull();
  });

  test('the merged card has the access points of all members', () => {
    expect([...api.accessPoints.keys()]).toEqual([ServiceEndpoint.generateId(api.id, 8000)]);
  });

  test('the merged card is found by its workload, not by one of its identities', () => {
    const kinds = api.filterEntries.map(fe => fe.kind);

    expect(kinds).toContain('workload');
    expect(kinds).not.toContain('identity');
  });

  test('without any workload, the merged card is found by its app name label', () => {
    const noWl = mergeMeshCards([
      workloadCard('4', 'qubicle', 'east'),
      workloadCard('5', 'qubicle', 'west'),
    ]);
    const labels = noWl.cards[0].filterEntries.filter(fe => fe.isLabel).map(fe => fe.query);

    expect(labels).toEqual(['k8s:app.kubernetes.io/name=qubicle']);
  });

  test('links of member cards become one link to the merged card', () => {
    const links = remapLinks(
      [
        link('a', '1', '9', Verdict.Forwarded),
        link('b', '2', '9', Verdict.Dropped),
        link('c', '9', 'klab-dns-west-receiver', Verdict.Forwarded),
      ],
      merged.idRemap,
    );

    const toAmqp = links.filter(l => l.destinationId === '9');
    expect(toAmqp).toHaveLength(1);
    expect(toAmqp[0].sourceId).toBe('mesh/kazoo/api');
    expect([...toAmqp[0].verdicts].sort()).toEqual([Verdict.Forwarded, Verdict.Dropped].sort());
    expect(links.find(l => l.id === 'c')).toBeDefined();
  });

  test('the store merges only its view, and only while the control is on', () => {
    const store = new ServiceStore();
    store.set([west.service, east.service, central.service, amqp.service]);

    const control = { mergeClusters: false };
    store.setViewControls(control);
    expect(store.viewCardsList).toHaveLength(4);

    control.mergeClusters = true;
    store.setViewControls({ ...control });
    expect(store.viewCardsList).toHaveLength(2);
    expect(store.viewById('mesh/kazoo/api')?.meshClusters).toEqual(['central', 'east', 'west']);
    expect(store.cardsList).toHaveLength(4);
  });
});
