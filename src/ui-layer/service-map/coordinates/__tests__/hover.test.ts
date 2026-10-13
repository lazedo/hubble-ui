import { ServiceMapArrow } from '~/ui-layer/service-map/coordinates/arrow';
import { computeHighlight, isHighlightActive } from '~/ui-layer/service-map/coordinates/hover';

// NOTE: alloy and kamailio both reach freeswitch: alloy on 9282, kamailio on
// NOTE: 11000 and 12000, each through its own connector
const arrows = (): Map<string, ServiceMapArrow> => {
  const alloy = ServiceMapArrow.new().from('alloy').to('freeswitch');
  alloy.addAccessPointArrow('c-metrics', 'freeswitch:9282');

  const kamailio = ServiceMapArrow.new().from('kamailio').to('freeswitch');
  kamailio.addAccessPointArrow('c-sip', 'freeswitch:11000');
  kamailio.addAccessPointArrow('c-sip', 'freeswitch:12000');

  const toAmqp = ServiceMapArrow.new().from('freeswitch').to('amqp');
  toAmqp.addAccessPointArrow('c-amqp', 'amqp:5672');

  return new Map([alloy, kamailio, toAmqp].map(a => [a.id, a]));
};

describe('arrows highlight', () => {
  test('nothing lights up without a hover', () => {
    const hl = computeHighlight(arrows(), null);

    expect(isHighlightActive(hl)).toBe(false);
  });

  test('an arrow lights up its whole path, down to its access points', () => {
    const hl = computeHighlight(arrows(), { kind: 'arrow', id: 'alloy -> freeswitch' });

    expect([...hl.arrows]).toEqual(['alloy -> freeswitch']);
    expect([...hl.connectors]).toEqual(['c-metrics']);
    expect([...hl.accessPoints]).toEqual(['freeswitch:9282']);
    expect([...hl.apArrows]).toEqual(['c-metrics -> freeswitch:9282']);
  });

  test('a connector lights up every path that goes through it', () => {
    const hl = computeHighlight(arrows(), { kind: 'connector', id: 'c-sip' });

    expect([...hl.arrows]).toEqual(['kamailio -> freeswitch']);
    expect([...hl.accessPoints].sort()).toEqual(['freeswitch:11000', 'freeswitch:12000']);
  });

  test('an access point lights up the paths that reach it, and only its own small arrow', () => {
    const hl = computeHighlight(arrows(), { kind: 'accessPoint', id: 'freeswitch:12000' });

    expect([...hl.arrows]).toEqual(['kamailio -> freeswitch']);
    expect([...hl.apArrows]).toEqual(['c-sip -> freeswitch:12000']);
    expect([...hl.accessPoints]).toEqual(['freeswitch:12000']);
  });

  test('a hover on something gone lights up nothing', () => {
    const hl = computeHighlight(arrows(), { kind: 'arrow', id: 'gone -> away' });

    expect(isHighlightActive(hl)).toBe(false);
  });
});
