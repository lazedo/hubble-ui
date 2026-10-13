import classnames from 'classnames';
import React, { memo } from 'react';

import { ServiceCard } from '~/domain/service-map';

import { EndpointLogo } from './EndpointLogo';

import css from './styles.scss';

export interface Props {
  card: ServiceCard;
  currentNamespace?: string | null;
  onHeadlineClick?: () => void;
}

export const EndpointCardHeader = memo(function EndpointCardHeader(props: Props) {
  const { card, currentNamespace } = props;
  const showNamespace = !!card.namespace && card.namespace !== currentNamespace;
  // NOTE: A named CIDR group of another cluster has no namespace of its own
  const subtitle = showNamespace ? card.namespace : card.cidrGroupNamespace;

  const titleClassName = classnames(css.title, {
    [css.single]: !subtitle,
  });

  return (
    <div className={css.wrapper}>
      <div className={css.headline} onClick={props.onHeadlineClick}>
        <EndpointLogo card={card} />

        <div className={css.headings}>
          <div className={titleClassName}>{card.caption}</div>
          {!!subtitle && <div className={css.subtitle}>{subtitle}</div>}
        </div>
      </div>
    </div>
  );
});
