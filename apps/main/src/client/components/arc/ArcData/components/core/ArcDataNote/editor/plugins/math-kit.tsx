'use client';

import { EquationPlugin, InlineEquationPlugin } from '@platejs/math/react';

import {
    EquationElement,
    InlineEquationElement,
} from '@/client/components/ui/equation-node';

export const MathKit = [
  InlineEquationPlugin.withComponent(InlineEquationElement),
  EquationPlugin.withComponent(EquationElement),
];
