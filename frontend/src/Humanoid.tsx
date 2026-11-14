import { Component, Suspense, lazy, useState } from 'react';
import type { ReactNode } from 'react';
import type { Status } from './types';
import { regions } from './lib';
const Body3D = lazy(() => import('./Body3D'));
export const colors: Record<Status, string> = {
  stable: '#72ddcc',
  review: '#efb566',
  emergency: '#f47d7d',
  insufficient_data: '#83929d',
};
class CanvasBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
export default function Humanoid({
  selected,
  onSelect,
  states,
}: {
  selected: string;
  onSelect: (id: string) => void;
  states: Record<string, Status>;
}) {
  const [mode, setMode] = useState<'svg' | '3d'>('svg');
  const target: Record<string, [number, number]> = {
    heart: [237, 205],
    lungs: [257, 178],
    brain: [245, 57],
    kidneys: [253, 266],
    muscles: [251, 378],
    skeleton: [242, 428],
    metabolic: [249, 242],
  };
  const [targetX, targetY] = target[selected] ?? target.heart;
  const svg = (
    <svg
      className="body-svg"
      viewBox="0 0 440 600"
      role="img"
      aria-label="Humanoide interactivo por sistemas corporales"
    >
      <defs>
        <linearGradient id="tissue" x1="0" x2="1">
          <stop stopColor="#203f48" stopOpacity=".55" />
          <stop offset=".5" stopColor="#32616a" stopOpacity=".15" />
          <stop offset="1" stopColor="#264d56" stopOpacity=".5" />
        </linearGradient>
        <linearGradient id="bone" x1="0" x2="1">
          <stop stopColor="#57969e" stopOpacity=".1" />
          <stop offset=".5" stopColor="#a6e3df" stopOpacity=".65" />
          <stop offset="1" stopColor="#57969e" stopOpacity=".1" />
        </linearGradient>
        <radialGradient id="glow">
          <stop stopColor="#66d9c5" stopOpacity=".12" />
          <stop offset="1" stopColor="#66d9c5" stopOpacity="0" />
        </radialGradient>
        <pattern id="scan" width="4" height="5" patternUnits="userSpaceOnUse">
          <path d="M0 0h4" stroke="#8cdacc" strokeWidth=".25" opacity=".14" />
        </pattern>
        <filter id="organGlow">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <ellipse cx="220" cy="285" rx="170" ry="240" fill="url(#glow)" />
      <g className="body-grid" fill="none" stroke="#344d53" strokeWidth=".6">
        <ellipse cx="220" cy="557" rx="108" ry="23" />
        <ellipse cx="220" cy="557" rx="76" ry="14" />
        <path
          d="M80 557h280M220 530v55M110 130h220M105 245h230M115 365h210M145 465h150"
          strokeDasharray="3 6"
        />
        <path d="M220 25v535" strokeDasharray="2 7" />
      </g>
      <g stroke="#6ba6aa" strokeWidth="1.1" fill="url(#tissue)">
        <path d="M198 95C182 86 181 68 185 48C188 29 202 22 220 22C238 22 252 29 255 48C259 68 258 86 242 95L240 116C254 122 273 121 287 137C302 154 302 177 307 201L325 262L336 307L333 334L324 341L316 326L313 307L300 282L280 229L272 199L265 248L272 292C277 314 272 338 264 354L257 416L249 470L248 528L261 544L258 554L228 554L224 544L224 477L220 419L216 477L216 544L212 554L182 554L179 544L192 528L191 470L183 416L176 354C168 338 163 314 168 292L175 248L168 199L160 229L140 282L127 307L124 326L116 341L107 334L104 307L115 262L133 201C138 177 138 154 153 137C167 121 186 122 200 116Z" />
        <path
          d="M190 67Q220 77 250 67M194 85Q220 100 246 85M205 104v20M235 104v20"
          fill="none"
          opacity=".45"
        />
      </g>
      <g fill="none" stroke="url(#bone)" strokeWidth="5" strokeLinecap="round" opacity=".8">
        <path d="M220 117v172M220 136Q193 124 165 146M220 136Q247 124 275 146M165 153L150 212L128 280M275 153L290 212L312 280M196 330L199 425L201 522M244 330L241 425L239 522M184 300Q220 333 256 300M184 300Q180 328 200 340M256 300Q260 328 240 340" />
      </g>
      <g fill="none" stroke="#85c2c2" opacity=".28" strokeWidth="1.4">
        {Array.from({ length: 8 }, (_, i) => (
          <path
            key={i}
            d={`M218 ${145 + i * 12}Q${170 - i} ${130 + i * 15} ${174 + i * 2} ${158 + i * 12}Q192 ${175 + i * 12} 216 ${165 + i * 12}M222 ${145 + i * 12}Q${270 + i} ${130 + i * 15} ${266 - i * 2} ${158 + i * 12}Q248 ${175 + i * 12} 224 ${165 + i * 12}`}
          />
        ))}
        {Array.from({ length: 17 }, (_, i) => (
          <path key={'v' + i} d={`M213 ${130 + i * 9}h14`} />
        ))}
        <path d="M194 352L190 414M204 352L207 414M246 352L250 414M236 352L233 414M193 443L194 514M205 443L207 514M247 443L246 514M235 443L233 514M146 230L130 273M294 230L310 273" />
      </g>
      {regions.map((r) => {
        const active = r.id === selected;
        const color = colors[states[r.id] ?? 'insufficient_data'];
        const common = {
          fill: color,
          fillOpacity: active ? 0.36 : 0.14,
          stroke: color,
          strokeWidth: active ? 1.8 : 1,
          style: { filter: active ? `drop-shadow(0 0 7px ${color}55)` : undefined },
        };
        return (
          <g
            key={r.id}
            role="button"
            aria-label={`Seleccionar ${r.name}`}
            tabIndex={0}
            onClick={() => onSelect(r.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(r.id);
              }
            }}
            className={`organ ${active ? 'active' : ''}`}
          >
            <title>{r.name}</title>
            {r.id === 'brain' && <rect x="189" y="33" width="64" height="53" fill="transparent" />}
            {r.id === 'lungs' && <rect x="175" y="147" width="90" height="80" fill="transparent" />}
            {r.id === 'brain' && (
              <>
                <path
                  {...common}
                  d="M219 38C202 29 189 43 192 55C184 65 192 82 206 82L219 86ZM223 38C240 29 253 43 250 55C258 65 250 82 236 82L223 86Z"
                />
                <path
                  d="M201 44Q214 48 205 57Q193 61 203 70M239 44Q226 48 235 57Q247 61 237 70"
                  fill="none"
                  stroke={color}
                  opacity=".6"
                />
              </>
            )}
            {r.id === 'lungs' && (
              <>
                <path
                  {...common}
                  d="M210 149Q197 141 185 163Q173 188 177 218Q192 232 212 214ZM230 149Q243 141 255 163Q267 188 263 218Q248 232 228 214Z"
                />
                <path
                  d="M220 134v32l-25 33M220 166l24 33M195 199l-8-2m8 2 4 10M244 199l8-2m-8 2-4 10"
                  stroke={color}
                  fill="none"
                  strokeWidth="2"
                  opacity=".45"
                />
              </>
            )}
            {r.id === 'heart' && (
              <path
                {...common}
                d="M217 192C200 175 193 195 203 213L222 233L237 209C247 190 229 185 224 194L224 181L218 180Z"
              />
            )}
            {r.id === 'kidneys' && (
              <>
                <path
                  {...common}
                  d="M195 249C178 241 178 273 192 281C205 285 208 271 198 267C191 262 204 255 195 249Z"
                />
                <path
                  {...common}
                  d="M245 249C262 241 262 273 248 281C235 285 232 271 242 267C249 262 236 255 245 249Z"
                />
              </>
            )}
            {r.id === 'metabolic' && (
              <>
                <path
                  {...common}
                  d="M190 236Q218 225 248 238L255 253Q235 265 218 249Q196 259 185 249Z"
                />
                <path
                  {...common}
                  d="M205 272q30-15 33 7t-30 15q-13-6 0-10t24 9"
                  fillOpacity=".08"
                />
              </>
            )}
            {r.id === 'skeleton' && (
              <g {...common} fill="none" strokeWidth={active ? 4 : 2} opacity={active ? 0.85 : 0.4}>
                <path d="M220 284v29M185 302Q220 324 255 302M199 339v79M241 339v79M200 437v84M240 437v84" />
                <circle cx="200" cy="428" r="7" />
                <circle cx="240" cy="428" r="7" />
              </g>
            )}
            {r.id === 'muscles' && (
              <g {...common} opacity={active ? 0.9 : 0.45}>
                <path d="M158 157Q171 167 157 208Q139 201 158 157ZM282 157Q269 167 283 208Q301 201 282 157ZM184 351Q206 343 209 374L207 412Q191 407 184 351ZM256 351Q234 343 231 374L233 412Q249 407 256 351Z" />
              </g>
            )}
          </g>
        );
      })}
      <g fill="none" stroke={colors[states[selected] ?? 'stable']} strokeWidth=".8" opacity=".65">
        <path d={`M${targetX} ${targetY}H305L331 183H397`} />
        <circle cx={targetX} cy={targetY} r="3" />
        <path d="M182 268H130L110 290H40" stroke="#53727c" />
        <circle cx="182" cy="268" r="2" stroke="#53727c" />
      </g>
      <text x="334" y="177" fill="#90b9bd" fontSize="8" letterSpacing="1.2">
        REGIÓN ACTIVA
      </text>
      <text x="41" y="305" fill="#587880" fontSize="8" letterSpacing="1">
        VISTA ANTERIOR
      </text>
    </svg>
  );
  return (
    <>
      <div className="body-mode">
        <button className={mode === 'svg' ? 'selected' : ''} onClick={() => setMode('svg')}>
          Esquema
        </button>
        <button className={mode === '3d' ? 'selected' : ''} onClick={() => setMode('3d')}>
          Vista 3D
        </button>
      </div>
      {mode === 'svg' ? (
        svg
      ) : (
        <CanvasBoundary fallback={svg}>
          <Suspense fallback={<div className="loading">Cargando geometría local…</div>}>
            <Body3D selected={selected} onSelect={onSelect} states={states} />
          </Suspense>
        </CanvasBoundary>
      )}
    </>
  );
}
