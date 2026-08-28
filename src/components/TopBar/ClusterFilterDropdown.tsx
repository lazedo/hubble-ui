import { Menu, MenuItem, Popover } from '@blueprintjs/core';
import React, { memo, useCallback } from 'react';

import { usePopover } from '~/ui/hooks/usePopover';

import { FilterIcon } from './FilterIcon';

export interface Props {
  clusters: string[];
  selected: string[];
  onToggle?: (cluster: string) => void;
  onClear?: () => void;
}

export const ClusterFilterDropdown = memo<Props>(function ClusterFilterDropdown(props) {
  const popover = usePopover();

  const getLabel = useCallback(() => {
    if (props.selected.length === 0) return 'All clusters';

    return props.selected.join(', ');
  }, [props.selected]);

  // NOTE: options must include selected clusters even before any of their
  // NOTE: flows were discovered (e.g. filter restored from the URL)
  const options = Array.from(new Set([...props.clusters, ...props.selected])).sort();

  const content = (
    <Menu>
      <MenuItem
        key="__all__"
        active={props.selected.length === 0}
        text="All clusters"
        shouldDismissPopover={false}
        onClick={() => props.onClear?.()}
      />
      {options.map(cluster => (
        <MenuItem
          key={cluster}
          active={props.selected.includes(cluster)}
          icon={props.selected.includes(cluster) ? 'tick' : 'blank'}
          text={cluster}
          shouldDismissPopover={false}
          onClick={() => props.onToggle?.(cluster)}
        />
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
