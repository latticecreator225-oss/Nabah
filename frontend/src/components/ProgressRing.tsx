import React from 'react';
import Svg, { Circle, G } from 'react-native-svg';
import { Colors } from '../theme';

type Props = {
  size?: number;
  progress: number; // 0..1
  stroke?: number;
};

export default function ProgressRing({ size = 240, progress, stroke = 6 }: Props) {
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const p = Math.max(0, Math.min(1, progress));
  const offset = circ * (1 - p);

  return (
    <Svg width={size} height={size}>
      <G rotation={-90} originX={size / 2} originY={size / 2}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={Colors.borderSubtle}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={Colors.gold}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </G>
    </Svg>
  );
}
