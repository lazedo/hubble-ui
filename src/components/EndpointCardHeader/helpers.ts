import _ from 'lodash';

import { ServiceCard } from '~/domain/service-map';

import * as logos from './logos';

export enum LogoType {
  PROTOCOL = 'logo',
  EMOJI = 'emoji',
}

export interface Logo {
  id: string;
  type: LogoType;
}

// NOTE: The bundled logo of a name, if there is one: logos.ts exports them in
// NOTE: camel case (couch-crdb-sink is couchCrdbSink)
const logoId = (name: string): string | null => {
  const id = _.camelCase(name.toLowerCase());
  return !!(logos as any)[id] ? id : null;
};

export const extractLogo = (ep: ServiceCard): Logo => {
  if (ep.isCovalentRelated) {
    return {
      id: 'covalent',
      type: LogoType.PROTOCOL,
    };
  }

  // NOTE: A CiliumCIDRGroup may choose its icon via the `icon` label on the
  // group (arrives as cidrgroup:icon=<key>); only keys of the bundled logo
  // set are honoured, anything else falls through to the globe.
  const cidrGroupIcon = ep.cidrGroupIcon != null ? logoId(ep.cidrGroupIcon) : null;
  if (!!cidrGroupIcon) {
    return {
      id: cidrGroupIcon,
      type: LogoType.PROTOCOL,
    };
  }

  if (ep.isWorld || ep.isDNS) {
    return {
      id: 'world',
      type: LogoType.PROTOCOL,
    };
  }

  if (ep.isHost) {
    return {
      id: 'host',
      type: LogoType.PROTOCOL,
    };
  }

  if (ep.isCIDR && ep.isAWS) {
    return {
      id: 'aws',
      type: LogoType.PROTOCOL,
    };
  }

  if (ep.isPrometheusApp) {
    return {
      id: 'prometheus',
      type: LogoType.PROTOCOL,
    };
  }

  // NOTE: The first of the card's names with a bundled logo (its app name,
  // NOTE: then its part-of and component labels); the globe and the host are
  // NOTE: for reserved identities only.
  const named = ep.logoCandidates.map(logoId).find(id => !!id && id !== 'world' && id !== 'host');

  return {
    id: named ?? 'kubernetes',
    type: LogoType.PROTOCOL,
  };
};
