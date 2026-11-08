import { describe, expect, it } from "vitest";
import { isBlockedAddress } from "../../infrastructure/http/blockedAddresses.js";

// ---------------------------------------------------------------------------
// Protección SSRF: una integración solo llega a Internet público.
// ---------------------------------------------------------------------------

describe("isBlockedAddress", () => {
  it.each([
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.10", "169.254.169.254", "100.64.0.1",
    "0.0.0.0", "224.0.0.1", "255.255.255.255", "198.18.0.1",
    "::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:169.254.169.254",
    "64:ff9b::a9fe:a9fe", "2002:7f00:1::1", "2001:db8::1", "no-es-ip"
  ])("bloquea %s", (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "172.32.0.1", "100.128.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8", "2a00:1450:4001::200e"])(
    "permite %s",
    (address) => {
      expect(isBlockedAddress(address)).toBe(false);
    }
  );
});
