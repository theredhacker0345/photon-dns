import * as React from 'react';

import { PocketHermesSupervisorViewProps } from './PocketHermesSupervisor.types';

export default function PocketHermesSupervisorView(props: PocketHermesSupervisorViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
