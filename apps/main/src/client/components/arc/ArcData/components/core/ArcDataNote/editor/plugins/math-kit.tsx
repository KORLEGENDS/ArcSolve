'use client';

import { EquationPlugin, InlineEquationPlugin } from '@platejs/math/react';

import {
    EquationElement,
    InlineEquationElement,
} from '../../ui/node/equation-node';

export const MathKit = [
  InlineEquationPlugin.withComponent(InlineEquationElement),
  EquationPlugin.withComponent(EquationElement),
];
