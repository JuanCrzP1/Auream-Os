import { isIP } from "node:net";

// ---------------------------------------------------------------------------
// Direcciones a las que una integración NO puede llegar (protección SSRF).
//
// Una URL la escribe el cliente; sin esta barrera podría apuntar a la red
// interna de la plataforma: la base de datos, el servicio de metadatos de la
// nube (169.254.169.254), otros servicios privados. Se bloquea todo lo que no
// es Internet público: privadas, loopback, enlace local, CGNAT, multicast,
// reservadas y documentación, en IPv4 e IPv6 (incluidas las IPv4 embebidas).
// ---------------------------------------------------------------------------

type Range4 = readonly [base: number, bits: number];

const ip4 = (text: string): number => text.split(".").reduce((acc, octet) => acc * 256 + Number(octet), 0);

const BLOCKED_V4: ReadonlyArray<Range4> = (
  [
    ["0.0.0.0", 8], // «esta» red
    ["10.0.0.0", 8], // privada
    ["100.64.0.0", 10], // CGNAT
    ["127.0.0.0", 8], // loopback
    ["169.254.0.0", 16], // enlace local (metadatos de la nube)
    ["172.16.0.0", 12], // privada
    ["192.0.0.0", 24], // asignaciones IETF
    ["192.0.2.0", 24], // documentación
    ["192.88.99.0", 24], // relé 6to4
    ["192.168.0.0", 16], // privada
    ["198.18.0.0", 15], // pruebas de rendimiento
    ["198.51.100.0", 24], // documentación
    ["203.0.113.0", 24], // documentación
    ["224.0.0.0", 4], // multicast
    ["240.0.0.0", 4] // reservada y difusión
  ] as const
).map(([base, bits]) => [ip4(base), bits] as const);

function inRange4(address: number, [base, bits]: Range4): boolean {
  const size = 2 ** (32 - bits);
  return address >= base && address < base + size;
}

function isBlockedV4(text: string): boolean {
  const address = ip4(text);
  return BLOCKED_V4.some((range) => inRange4(address, range));
}

/** IPv6 → 8 grupos de 16 bits. Admite `::` y una IPv4 al final. */
function groups6(text: string): number[] | null {
  let address = text.toLowerCase().split("%")[0]!;
  const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(address);
  if (v4) {
    const value = ip4(v4[1]!);
    address = `${address.slice(0, -v4[1]!.length)}${(value >>> 16).toString(16)}:${(value & 0xffff).toString(16)}`;
  }
  const [head, tail] = address.split("::") as [string, string | undefined];
  const parse = (part: string) => (part ? part.split(":").map((group) => parseInt(group, 16)) : []);
  const left = parse(head);
  const right = tail === undefined ? [] : parse(tail);
  const fill = tail === undefined ? 0 : 8 - left.length - right.length;
  const all = [...left, ...Array<number>(Math.max(fill, 0)).fill(0), ...right];
  return all.length === 8 && all.every((group) => Number.isInteger(group) && group >= 0 && group <= 0xffff) ? all : null;
}

function embeddedV4(groups: ReadonlyArray<number>): string {
  const [a, b] = [groups[6]!, groups[7]!];
  return `${a >> 8}.${a & 0xff}.${b >> 8}.${b & 0xff}`;
}

function isBlockedV6(text: string): boolean {
  const g = groups6(text);
  if (!g) return true; // lo que no se entiende, no se permite
  const zeroPrefix = (count: number) => g.slice(0, count).every((group) => group === 0);

  if (zeroPrefix(8)) return true; // ::
  if (zeroPrefix(7) && g[7] === 1) return true; // ::1
  if (zeroPrefix(5) && g[5] === 0xffff) return isBlockedV4(embeddedV4(g)); // ::ffff:a.b.c.d
  if (zeroPrefix(6)) return isBlockedV4(embeddedV4(g)); // ::a.b.c.d (obsoleta)
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((group) => group === 0)) return isBlockedV4(embeddedV4(g)); // NAT64
  if ((g[0]! & 0xfe00) === 0xfc00) return true; // fc00::/7 local única
  if ((g[0]! & 0xffc0) === 0xfe80) return true; // fe80::/10 enlace local
  if ((g[0]! & 0xffc0) === 0xfec0) return true; // fec0::/10 sitio local (obsoleta)
  if ((g[0]! & 0xff00) === 0xff00) return true; // multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // documentación
  if (g[0] === 0x2002) return isBlockedV4(`${g[1]! >> 8}.${g[1]! & 0xff}.${g[2]! >> 8}.${g[2]! & 0xff}`); // 6to4
  return false;
}

/** ¿Está prohibido conectar a esta IP? Lo que no es una IP válida, también. */
export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isBlockedV4(address);
  if (family === 6) return isBlockedV6(address);
  return true;
}
