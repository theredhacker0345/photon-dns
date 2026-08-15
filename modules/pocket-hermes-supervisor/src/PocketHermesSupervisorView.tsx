import { requireNativeView } from 'expo';
import * as React from 'react';

import { PocketHermesSupervisorViewProps } from './PocketHermesSupervisor.types';

const NativeView: React.ComponentType<PocketHermesSupervisorViewProps> =
  requireNativeView('PocketHermesSupervisor');

export default function PocketHermesSupervisorView(props: PocketHermesSupervisorViewProps) {
  return <NativeView {...props} />;
}
