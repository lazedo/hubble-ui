import { HubbleService, Workload } from '~/domain/hubble';
import { Link } from '~/domain/link';
import { ServiceEndpoint } from '~/domain/interactions/endpoints';
import * as dhelpers from '~/domain/helpers';

import { ServiceCard } from './card';

// NOTE: In a cluster mesh every cluster has its own identities, and the card
// NOTE: id of a workload is its identity: the same workload shows up as one
// NOTE: card per cluster. Merging gives one card per namespace and app name
// NOTE: that lists the clusters it was seen in, and re-points the links to
// NOTE: it. Only workloads of a cluster merge; world, reserved and DNS cards
// NOTE: stay as they are.
export type MeshMerge = {
  cards: ServiceCard[];
  // NOTE: member card id -> merged card id
  idRemap: Map<string, string>;
};

export const meshMergeKey = (card: ServiceCard): string | null => {
  if (card.clusterName == null || card.namespace == null || card.appLabel == null) return null;
  if (card.isWorld || card.isHost || card.isInit || card.isRemoteNode) return null;
  if (card.isIngress || card.isDNS || card.isCIDR) return null;

  return `mesh/${card.namespace}/${card.appLabel}`;
};

// NOTE: The pinned identities are the ones a filter picks out: their cards
// NOTE: stay on their own, as merging them would hide their cluster.
export const mergeMeshCards = (
  cards: ServiceCard[],
  pinned: Set<number> = new Set(),
): MeshMerge => {
  const result: MeshMerge = { cards: [], idRemap: new Map() };
  const groups = new Map<string, ServiceCard[]>();

  cards.forEach(card => {
    const key = pinned.has(card.identity) ? null : meshMergeKey(card);
    if (key == null) {
      result.cards.push(card);
      return;
    }

    const group = groups.get(key);
    group != null ? group.push(card) : groups.set(key, [card]);
  });

  groups.forEach((members, key) => {
    if (members.length === 1) {
      result.cards.push(members[0]);
      return;
    }

    members.sort((a, b) => (a.clusterName ?? '').localeCompare(b.clusterName ?? ''));
    members.forEach(m => result.idRemap.set(m.id, key));

    const service: HubbleService = {
      ...members[0].service,
      id: key,
      labels: commonLabels(members),
      workloads: uniqueWorkloads(members),
    };
    const clusters = [...new Set(members.map(m => m.clusterName!))];

    result.cards.push(
      new ServiceCard(service, { clusters, accessPoints: mergedAPs(members, key) }),
    );
  });

  return result;
};

// NOTE: Links of member cards, re-pointed to the merged cards; the links that
// NOTE: become the same (sender, receiver, port, protocol) are one link with
// NOTE: the verdicts of all of them.
export const remapLinks = (links: Link[], idRemap: Map<string, string>): Link[] => {
  if (idRemap.size === 0) return links;

  const result = new Map<string, Link>();
  links.forEach(link => {
    const sourceId = idRemap.get(link.sourceId) ?? link.sourceId;
    const destinationId = idRemap.get(link.destinationId) ?? link.destinationId;

    if (sourceId === link.sourceId && destinationId === link.destinationId) {
      result.set(link.id, link);
      return;
    }

    const id = `${sourceId}->${destinationId}:${link.destinationPort}/${link.ipProtocol}`;
    const remapped =
      result.get(id) ?? Link.fromHubbleLink({ ...link.hubbleLink, id, sourceId, destinationId });

    link.verdicts.forEach(v => remapped.verdicts.add(v));
    link.authTypes.forEach(a => remapped.authTypes.add(a));
    result.set(id, remapped);
  });

  return [...result.values()];
};

// NOTE: The labels all the members share: the ones that tell them apart, such
// NOTE: as their cluster or zone, are on the badges of the merged card.
const commonLabels = (members: ServiceCard[]): HubbleService['labels'] => {
  const [first, ...rest] = members;

  return first.service.labels.filter(l =>
    rest.every(m => m.service.labels.some(o => o.key === l.key && o.value === l.value)),
  );
};

const uniqueWorkloads = (members: ServiceCard[]): Workload[] => {
  const result: Workload[] = [];
  members.forEach(m => {
    m.service.workloads.forEach(wl => {
      if (!dhelpers.workload.includes(result, wl)) result.push(wl);
    });
  });

  return result;
};

const mergedAPs = (members: ServiceCard[], key: string): ServiceEndpoint[] => {
  const aps = new Map<string, ServiceEndpoint>();
  members.forEach(m => {
    m.accessPoints.forEach(ap => {
      const copy = new ServiceEndpoint(key, ap.port, ap.l4Protocol, ap.verdicts);
      copy.accumulateL7Protocol(ap.l7Protocol);

      const existing = aps.get(copy.id);
      existing != null ? existing.update(copy) : aps.set(copy.id, copy);
    });
  });

  return [...aps.values()];
};
