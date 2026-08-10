import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { Colors } from '../theme';

type IconProps = { size?: number; color?: string };

export const TasbeehIcon = ({ size = 28, color = Colors.gold }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.4" />
    <Circle cx="12" cy="3" r="1.6" fill={color} />
    <Circle cx="21" cy="12" r="1.4" fill={color} />
    <Circle cx="12" cy="21" r="1.4" fill={color} />
    <Circle cx="3" cy="12" r="1.4" fill={color} />
    <Circle cx="18.4" cy="5.6" r="1.1" fill={color} />
    <Circle cx="18.4" cy="18.4" r="1.1" fill={color} />
    <Circle cx="5.6" cy="18.4" r="1.1" fill={color} />
    <Circle cx="5.6" cy="5.6" r="1.1" fill={color} />
  </Svg>
);

export const HeartIcon = ({ size = 28, color = Colors.gold }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 21s-7-4.5-9-9.2C1.5 8.1 3.7 5 7 5c1.9 0 3.5 1 5 2.6C13.5 6 15.1 5 17 5c3.3 0 5.5 3.1 4 6.8C19 16.5 12 21 12 21z"
      stroke={color}
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  </Svg>
);

export const BookIcon = ({ size = 28, color = Colors.gold }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M4 4h6c1.7 0 3 1.3 3 3v13c0-1.7-1.3-3-3-3H4V4z"
      stroke={color}
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <Path
      d="M20 4h-6c-1.7 0-3 1.3-3 3v13c0-1.7 1.3-3 3-3h6V4z"
      stroke={color}
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  </Svg>
);

export const BellIcon = ({ size = 22, color = Colors.gold, filled = false }: IconProps & { filled?: boolean }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'}>
    <Path
      d="M6 17h12l-1.5-2V11a4.5 4.5 0 1 0-9 0v4L6 17zM10 20a2 2 0 1 0 4 0"
      stroke={color}
      strokeWidth="1.4"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  </Svg>
);

export const CheckIcon = ({ size = 18, color = Colors.gold }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M5 12l4 4 10-10"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const ChevronDown = ({ size = 18, color = Colors.gold }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M6 9l6 6 6-6" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const ChevronRight = ({ size = 18, color = Colors.gold }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M9 6l6 6-6 6" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const ShareIcon = ({ size = 18, color = Colors.gold }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7M12 16V4M8 8l4-4 4 4"
      stroke={color}
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const CloseIcon = ({ size = 18, color = Colors.textSecondary }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M6 6l12 12M18 6l-12 12" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
  </Svg>
);

export const VolumeIcon = ({ size = 14, color = Colors.gold }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M5 9h3l5-4v14l-5-4H5V9zM16 8a5 5 0 0 1 0 8" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const SettingsIcon = ({ size = 22, color = Colors.gold }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.4" />
    <Path
      d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
      stroke={color}
      strokeWidth="1.2"
    />
  </Svg>
);

export const SparkleIcon = ({ size = 14, color = Colors.gold }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"
      stroke={color}
      strokeWidth="1.2"
      strokeLinejoin="round"
      fill={color}
      opacity={0.9}
    />
  </Svg>
);

export const BookmarkIcon = ({ size = 22, color = Colors.gold, filled = false }: IconProps & { filled?: boolean }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'}>
    <Path
      d="M6 4h12v17l-6-4-6 4V4z"
      stroke={color}
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  </Svg>
);

export const PlayIcon = ({ size = 18, color = Colors.gold }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M7 5l12 7-12 7V5z" stroke={color} strokeWidth="1.4" strokeLinejoin="round" fill={color} opacity={0.9} />
  </Svg>
);

export const PauseIcon = ({ size = 18, color = Colors.gold }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="6" y="5" width="4" height="14" rx="1" fill={color} />
    <Rect x="14" y="5" width="4" height="14" rx="1" fill={color} />
  </Svg>
);

export const CopyIcon = ({ size = 18, color = Colors.gold }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="9" y="9" width="11" height="11" rx="2" stroke={color} strokeWidth="1.4" />
    <Path d="M5 15V6a1 1 0 0 1 1-1h9" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
  </Svg>
);

export const SearchIcon = ({ size = 18, color = Colors.textDim }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth="1.4" />
    <Path d="M20 20l-3.5-3.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
  </Svg>
);

export const QuranIcon = ({ size = 24, color = Colors.gold }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v15H5.5C4.7 19 4 18.3 4 17.5V5.5z" stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
    <Path d="M20 5.5C20 4.7 19.3 4 18.5 4H13v15h5.5c.8 0 1.5-.7 1.5-1.5V5.5z" stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
    <Path d="M12 19v2.2M9.4 21.2h5.2" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    <Circle cx="12" cy="11" r="1.5" fill={color} opacity={0.9} />
  </Svg>
);

export const DuaIcon = ({ size = 24, color = Colors.gold }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* cupped hands raised in supplication */}
    <Path d="M7 11c-1.5 0-2.5 1.2-2.5 2.8 0 2.7 3 5.2 7.5 6.7 4.5-1.5 7.5-4 7.5-6.7 0-1.6-1-2.8-2.5-2.8" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M9 12V6.5a1.2 1.2 0 0 1 2.4 0V11M14.9 12V6.5a1.2 1.2 0 0 0-2.4 0V11" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M12 3.5v1.6M10.8 4.3h2.4" stroke={color} strokeWidth="1.1" strokeLinecap="round" opacity={0.8} />
  </Svg>
);

export const QiblaIcon = ({ size = 22, color = Colors.gold }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.3" />
    <Path d="M12 3.5 L14 12 L12 20.5 L10 12 Z" fill={color} opacity={0.9} />
    <Circle cx="12" cy="12" r="1.6" fill={color} />
  </Svg>
);
