import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { palette } from './theme';

/** Decorative orange→cyan curved ribbon (design-system pattern). */
export function Wave({
  width = 260,
  height = 120,
  style,
}: {
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Svg width={width} height={height} viewBox="0 0 260 120" style={style} pointerEvents="none">
      <Defs>
        <LinearGradient id="wave" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={palette.waveOrange} />
          <Stop offset="1" stopColor={palette.cyan} />
        </LinearGradient>
      </Defs>
      <Path
        d="M0 96 C 50 40, 90 120, 140 70 S 220 10, 260 40 L 260 64 C 220 34, 190 96, 140 98 S 50 82, 0 120 Z"
        fill="url(#wave)"
      />
    </Svg>
  );
}
