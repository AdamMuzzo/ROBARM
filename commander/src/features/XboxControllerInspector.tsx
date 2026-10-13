import xboxControllerBase from '../assets/gamepad-viewer/xbox-one-base-black.svg';
import { gamepadAxisLabel, gamepadButtonLabel, type ControllerProfile } from '../core/inputPlugins';
import { JOINTS } from '../core/hardware';
import { cn } from '../lib/cn';

export interface LiveGamepadState {
  id: string;
  mapping: string;
  axes: number[];
  buttons: Array<{ pressed: boolean; touched: boolean; value: number }>;
  timestamp: number;
}

const BUTTON_POINTS: Record<number, [number, number]> = {
  0: [641, 349], 1: [691, 299], 2: [591, 299], 3: [641, 249],
  4: [252, 172], 5: [648, 172], 6: [271, 104], 7: [629, 104],
  8: [384, 302], 9: [516, 302], 10: [260, 300], 11: [548, 413],
  12: [353, 386], 13: [353, 470], 14: [311, 428], 15: [395, 428],
  16: [450, 231]
};

const CALLOUTS: Array<{ button: number; x: number; y: number; side: 'left' | 'right'; short: string }> = [
  { button: 6, x: 20, y: 35, side: 'left', short: 'LT' },
  { button: 4, x: 20, y: 86, side: 'left', short: 'LB' },
  { button: 10, x: 20, y: 228, side: 'left', short: 'LS click' },
  { button: 8, x: 20, y: 279, side: 'left', short: 'View' },
  { button: 12, x: 20, y: 356, side: 'left', short: 'D-pad up' },
  { button: 14, x: 20, y: 407, side: 'left', short: 'D-pad left' },
  { button: 15, x: 20, y: 458, side: 'left', short: 'D-pad right' },
  { button: 13, x: 20, y: 509, side: 'left', short: 'D-pad down' },
  { button: 7, x: 730, y: 35, side: 'right', short: 'RT' },
  { button: 5, x: 730, y: 86, side: 'right', short: 'RB' },
  { button: 3, x: 730, y: 188, side: 'right', short: 'Y' },
  { button: 1, x: 730, y: 239, side: 'right', short: 'B' },
  { button: 0, x: 730, y: 290, side: 'right', short: 'A' },
  { button: 2, x: 730, y: 341, side: 'right', short: 'X' },
  { button: 9, x: 730, y: 392, side: 'right', short: 'Menu' },
  { button: 11, x: 730, y: 443, side: 'right', short: 'RS click' },
  { button: 16, x: 730, y: 494, side: 'right', short: 'Xbox' }
];

function jointBinding(profile: ControllerProfile, button: number) {
  const labels: string[] = [];
  if (profile.deadmanButton === button) labels.push('DEAD-MAN');
  if (profile.disableButton === button) labels.push('DISABLE');
  if (profile.stopChord.includes(button)) labels.push('STOP CHORD');
  for (const mapping of profile.buttonMappings.filter((item) => item.button === button)) {
    const joint = JOINTS[mapping.joint];
    labels.push(`J${joint.number} ${mapping.direction === 'positive' ? '+' : '−'}`);
  }
  return labels.join(' · ') || 'UNASSIGNED';
}

function axisBinding(profile: ControllerProfile, axis: number) {
  const labels = profile.mappings
    .filter((mapping) => mapping.axis === axis)
    .map((mapping) => `J${JOINTS[mapping.joint].number}${mapping.invert ? ' INV' : ''}`);
  return labels.join(' · ') || 'UNASSIGNED';
}

function Callout({
  button,
  x,
  y,
  side,
  short,
  active,
  binding,
  onSelect
}: (typeof CALLOUTS)[number] & { active: boolean; binding: string; onSelect: (button: number) => void }) {
  const [pointX, pointY] = BUTTON_POINTS[button];
  const width = 150;
  const edgeX = side === 'left' ? x + width : x;
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${gamepadButtonLabel(button)}. ${binding}. Add mapping`}
      className="cursor-pointer outline-none"
      onClick={() => onSelect(button)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(button);
        }
      }}
    >
      <path d={`M${edgeX} ${y + 21} L${pointX} ${pointY}`} stroke={active ? '#e8a72c' : '#596059'} strokeWidth="1.5" fill="none" />
      <circle cx={pointX} cy={pointY} r={active ? 13 : 8} fill={active ? '#e8a72c' : '#121412'} fillOpacity={active ? 0.55 : 0.7} stroke={active ? '#ffd477' : '#6f776e'} strokeWidth="2" />
      <rect x={x} y={y} width={width} height="42" fill={active ? '#3b3019' : '#191c19'} stroke={active ? '#e8a72c' : '#454b44'} strokeWidth="1.5" />
      <text x={x + 9} y={y + 16} fill={active ? '#ffd477' : '#f0eee7'} fontFamily="IBM Plex Mono" fontSize="11" fontWeight="600">{short} · B{button}</text>
      <text x={x + 9} y={y + 32} fill={active ? '#ffd477' : '#9da39a'} fontFamily="IBM Plex Mono" fontSize="8.5">{binding.length > 22 ? `${binding.slice(0, 21)}…` : binding}</text>
    </g>
  );
}

export function XboxControllerInspector({ state, profile, onAddAxis, onAddButton }: {
  state: LiveGamepadState | null;
  profile: ControllerProfile;
  onAddAxis: (axis: number) => void;
  onAddButton: (button: number) => void;
}) {
  const axes = state?.axes ?? [0, 0, 0, 0];
  const isPressed = (button: number) => state?.buttons[button]?.pressed === true || (state?.buttons[button]?.value ?? 0) > 0.08;
  const leftX = axes[0] ?? 0;
  const leftY = axes[1] ?? 0;
  const rightX = axes[2] ?? 0;
  const rightY = axes[3] ?? 0;

  return (
    <div className="border-b border-line bg-[#151815] p-3">
      <div className="mb-2 flex items-center justify-between gap-3 font-mono text-[10px] tabular-nums text-muted">
        <span className="truncate">{state?.id ?? 'NO LIVE CONTROLLER SELECTED'}</span>
        <span className={cn('shrink-0', state && 'text-[#9bc79a]')}>{state ? `${state.mapping || 'raw'} · LIVE` : 'WAITING'}</span>
      </div>
      <svg viewBox="0 0 900 650" className="mx-auto block h-auto max-h-[620px] w-full max-w-[900px]" aria-label="Live labeled Xbox controller input map">
        <image href={xboxControllerBase} x="75" y="20" width="750" height="630" opacity={state ? 1 : 0.55} />

        <circle cx={260 + leftX * 17} cy={300 + leftY * 17} r="33" fill="none" stroke={Math.hypot(leftX, leftY) > 0.08 ? '#e8a72c' : '#596059'} strokeWidth="4" />
        <circle cx={548 + rightX * 17} cy={413 + rightY * 17} r="33" fill="none" stroke={Math.hypot(rightX, rightY) > 0.08 ? '#e8a72c' : '#596059'} strokeWidth="4" />

        <rect x="244" y="15" width="54" height="8" fill="#222622" stroke="#454b44" />
        <rect x="244" y="15" width={54 * (state?.buttons[6]?.value ?? 0)} height="8" fill="#e8a72c" />
        <rect x="602" y="15" width="54" height="8" fill="#222622" stroke="#454b44" />
        <rect x={656 - 54 * (state?.buttons[7]?.value ?? 0)} y="15" width={54 * (state?.buttons[7]?.value ?? 0)} height="8" fill="#e8a72c" />

        {CALLOUTS.map((callout) => (
          <Callout
            key={callout.button}
            {...callout}
            active={isPressed(callout.button)}
            binding={jointBinding(profile, callout.button)}
            onSelect={onAddButton}
          />
        ))}

        {[0, 1, 2, 3].map((axis, index) => {
          const x = 186 + index * 132;
          const active = Math.abs(axes[axis] ?? 0) > 0.08;
          return (
            <g key={axis} role="button" tabIndex={0} className="cursor-pointer outline-none" onClick={() => onAddAxis(axis)} onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onAddAxis(axis); }
            }} aria-label={`${gamepadAxisLabel(axis)}. ${axisBinding(profile, axis)}. Add mapping`}>
              <rect x={x} y="594" width="122" height="45" fill={active ? '#3b3019' : '#191c19'} stroke={active ? '#e8a72c' : '#454b44'} />
              <text x={x + 8} y="611" fill={active ? '#ffd477' : '#f0eee7'} fontFamily="IBM Plex Mono" fontSize="9.5">{gamepadAxisLabel(axis)}</text>
              <text x={x + 8} y="628" fill={active ? '#ffd477' : '#9da39a'} fontFamily="IBM Plex Mono" fontSize="9">{(axes[axis] ?? 0).toFixed(3)} · {axisBinding(profile, axis)}</text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-pretty text-[11px] leading-4 text-muted">Press or move anything to identify it. Highlighting is the raw browser input; the second line on every label is Commander’s assigned action. Click any label to add another mapping for that control.</p>
    </div>
  );
}
