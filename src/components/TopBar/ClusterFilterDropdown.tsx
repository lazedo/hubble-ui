import { Menu, MenuDivider, MenuItem, Popover } from '@blueprintjs/core';
import React, { memo, useCallback } from 'react';

import { FilterDirection, FilterEntry } from '~/domain/filtering';
import { usePopover } from '~/ui/hooks/usePopover';

import { FilterIcon } from './FilterIcon';

export interface Props {
  clusters: string[];
  // NOTE: the positive cluster filter entries, each with its direction
  selected: FilterEntry[];
  onToggle?: (cluster: string, direction: FilterDirection) => void;
  onClear?: () => void;
}

// NOTE: "Observed in" is the cluster whose nodes saw the flow; Source and
// NOTE: Destination are the clusters of the two endpoints, which tell apart
// NOTE: the ends of a flow that crosses the mesh
const sections = [
  { direction: FilterDirection.Either, title: 'Observed in', prefix: '' },
  { direction: FilterDirection.From, title: 'Source', prefix: 'from ' },
  { direction: FilterDirection.To, title: 'Destination', prefix: 'to ' },
];

export const ClusterFilterDropdown = memo<Props>(function ClusterFilterDropdown(props) {
  const popover = usePopover();

  const namesOf = useCallback(
    (dir: FilterDirection) => props.selected.filter(fe => fe.direction === dir).map(fe => fe.query),
    [props.selected],
  );

  const getLabel = useCallback(() => {
    if (props.selected.length === 0) return 'All clusters';

    return sections
      .map(s => [s.prefix, namesOf(s.direction)] as const)
      .filter(([, names]) => names.length > 0)
      .map(([prefix, names]) => `${prefix}${names.join(', ')}`)
      .join(' · ');
  }, [props.selected, namesOf]);

  // NOTE: options must include selected clusters even before any of their
  // NOTE: flows were discovered (e.g. filter restored from the URL)
  const options = Array.from(
    new Set([...props.clusters, ...props.selected.map(fe => fe.query)]),
  ).sort();

  const content = (
    <Menu>
      <MenuItem
        key="__all__"
        active={props.selected.length === 0}
        text="All clusters"
        shouldDismissPopover={false}
        onClick={() => props.onClear?.()}
      />
      {options.length > 0 &&
        sections.map(s => (
          <React.Fragment key={s.direction}>
            <MenuDivider title={s.title} />
            {options.map(cluster => {
              const isOn = namesOf(s.direction).includes(cluster);

              return (
                <MenuItem
                  key={`${s.direction}-${cluster}`}
                  active={isOn}
                  icon={isOn ? 'tick' : 'blank'}
                  text={cluster}
                  shouldDismissPopover={false}
                  onClick={() => props.onToggle?.(cluster, s.direction)}
                />
              );
            })}
          </React.Fragment>
        ))}
      {options.length === 0 && <MenuItem disabled={true} text="No clusters discovered yet" />}
    </Menu>
  );

  return (
    <Popover {...popover.props} content={content}>
      <FilterIcon icon={<ClustersIcon />} text={getLabel()} onClick={popover.toggle} />
    </Popover>
  );
});

function ClustersIcon() {
  return (
    <svg width="21" height="16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <rect width="21" height="16" rx="2" />
      <circle cx="6.5" cy="5.5" r="2" fill="#fff" />
      <circle cx="14.5" cy="5.5" r="2" fill="#fff" />
      <circle cx="10.5" cy="11" r="2" fill="#fff" />
      <path d="M6.5 5.5h8M6.5 5.5l4 5.5M14.5 5.5l-4 5.5" stroke="#fff" strokeWidth=".8" />
    </svg>
  );
}
