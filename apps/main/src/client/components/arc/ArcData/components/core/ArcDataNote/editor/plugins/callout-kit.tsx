'use client';

import { CalloutPlugin } from '@platejs/callout/react';

import { CalloutElement } from '@/client/components/ui/callout-node';

export const CalloutKit = [CalloutPlugin.withComponent(CalloutElement)];
