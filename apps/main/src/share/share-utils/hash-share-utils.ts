/**
 * 해시 유틸리티
 * - djb2 변형 기반의 경량 해시
 * - 문자열/객체(JSON 직렬화)/노드 배열에 대한 헬퍼 제공
 */

/** 문자열을 djb2 변형으로 해싱하여 base36 문자열을 반환 */
export function computeHashFromString(input: string): string {
  let hash = 5381 >>> 0;
  for (let i = 0; i < input.length; i++) {
    // hash * 33 ^ charCode
    hash = (((hash << 5) + hash) ^ input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

/**
 * 해시 계산을 위한 정규화:
 * - selection/offset/key/id 등 휘발성 키 제거
 * - 객체 키 정렬(stable)
 */
export function normalizeForHash(value: unknown): unknown {
  const volatileKeys = new Set([
    'key',
    'id',
    'path',
    'offset',
    'anchor',
    'focus',
    'selection',
    'marks',
    'temp',
    '__proto__',
  ]);

  const seen = new WeakSet();

  const normalize = (v: any): any => {
    if (v === null || typeof v !== 'object') return v;
    if (seen.has(v)) return undefined;
    seen.add(v);

    if (Array.isArray(v)) return v.map(normalize);

    const keys = Object.keys(v)
      .filter((k) => !volatileKeys.has(k))
      .sort();
    const out: Record<string, any> = {};
    for (const k of keys) {
      out[k] = normalize(v[k]);
    }
    return out;
  };

  return normalize(value);
}

/**
 * 정규화된 값을 안정적으로 직렬화하는 경량 직렬화기(JSON.stringify 대체)
 * - 키 정렬 보장(이미 normalizeForHash에서 정렬되지만 안전 차원에서 재확인)
 * - BigInt/NaN/Infinity 등 비표준 JSON 값도 안정적으로 처리
 */
function stableSerialize(value: unknown): string {
  if (value === null) return 'n';
  const t = typeof value;
  if (t === 'string') return `s${(value as string).length}:${value as string}`;
  if (t === 'number') {
    const num = value as number;
    const tag = Number.isNaN(num) ? 'NaN' : num === Infinity ? 'Inf' : num === -Infinity ? '-Inf' : String(num);
    return `d${tag}`;
  }
  if (t === 'boolean') return (value as boolean) ? 'b1' : 'b0';
  if (t === 'bigint') return `g${(value as bigint).toString()}`;
  if (t === 'undefined') return 'u';
  if (t === 'symbol') return `y${String((value as symbol).description ?? '')}`;
  if (t === 'function') return 'f';

  // 배열 처리
  if (Array.isArray(value)) {
    let out = '[';
    for (let i = 0; i < value.length; i++) {
      if (i) out += ',';
      out += stableSerialize(value[i]);
    }
    out += ']';
    return out;
  }

  // 객체 처리(키 정렬)
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  let out = '{';
  for (let i = 0; i < keys.length; i++) {
    if (i) out += ',';
    const k = keys[i];
    out += `k${k?.length}:${k}=`;
    out += stableSerialize(obj[k ?? '']);
  }
  out += '}';
  return out;
}

/** 객체를 안정 직렬화(정규화 포함)하여 해시(base36)를 반환 */
export function computeHashFromJson(value: unknown): string {
  const normalized = normalizeForHash(value);
  const serialized = stableSerialize(normalized);
  return computeHashFromString(serialized);
}

/** Slate/Plate 등의 노드 배열을 해시(base36)로 계산 */
export function computeHashFromNodes(nodes: unknown[]): string {
  return computeHashFromJson(nodes);
}

/** 두 값의 동등성(해시 기준) 비교 헬퍼 */
export function isHashEqual(a: unknown[], b: unknown[]): boolean {
  return computeHashFromJson(a) === computeHashFromJson(b);
}


