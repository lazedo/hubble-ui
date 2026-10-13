import { extractLogo } from '~/components/EndpointCardHeader/helpers';
import { HubbleService } from '~/domain/hubble';
import { Labels } from '~/domain/labels';
import { ServiceCard } from '~/domain/service-map';

import { services } from '~/testing/data';

// NOTE: The labels the operators of the klab set on their pods
const card = (...labels: string[]): ServiceCard => {
  const service: HubbleService = {
    ...services.regular,
    labels: labels.map(l => Labels.toKV(l)),
    workloads: [],
  };

  return ServiceCard.fromService(service);
};

const logo = (...labels: string[]) => extractLogo(card(...labels)).id;

describe('card logo', () => {
  test('the app name, when it has a logo', () => {
    expect(logo('k8s:app.kubernetes.io/name=couchdb', 'k8s:app.kubernetes.io/instance=db')).toBe(
      'couchdb',
    );
    expect(
      logo('k8s:app.kubernetes.io/name=cockroachdb', 'k8s:app.kubernetes.io/component=database'),
    ).toBe('cockroachdb');
    // NOTE: before the part-of label of the whole product
    expect(
      logo(
        'k8s:app.kubernetes.io/name=kamailio',
        'k8s:app.kubernetes.io/part-of=kazoo',
        'k8s:app.kubernetes.io/component=proxy',
      ),
    ).toBe('kamailio');
  });

  test('then the part-of label', () => {
    expect(
      logo(
        'k8s:app.kubernetes.io/name=amqp',
        'k8s:app.kubernetes.io/part-of=rabbitmq',
        'k8s:app.kubernetes.io/component=rabbitmq',
      ),
    ).toBe('rabbitmq');
  });

  test('then the component label', () => {
    expect(
      logo(
        'k8s:app.kubernetes.io/name=callmgr',
        'k8s:app.kubernetes.io/part-of=kazoo',
        'k8s:app.kubernetes.io/component=erlang',
      ),
    ).toBe('erlang');
  });

  test('kubernetes when none has a logo, and never the globe of a reserved identity', () => {
    expect(logo('k8s:app=dalsegno')).toBe('kubernetes');
    expect(logo('k8s:app=host')).toBe('kubernetes');
  });

  test('a cidr group keeps its own icon', () => {
    expect(logo('reserved:world', 'cidrgroup:icon=rabbitmq')).toBe('rabbitmq');
    expect(logo('reserved:world', 'cidrgroup:icon=nologo')).toBe('world');
  });

  test('a dashed or capitalised name finds its camel case logo', () => {
    // NOTE: the sink's pod, and its Service as another cluster sees it
    expect(logo('k8s:app=couch-crdb-sink')).toBe('couchCrdbSink');
    expect(logo('reserved:world', 'cidrgroup:icon=couch-crdb-sink')).toBe('couchCrdbSink');
    expect(logo('k8s:app.kubernetes.io/name=RabbitMQ')).toBe('rabbitmq');
  });
});
