import type { Hex } from 'viem';

export function requiredPrivateKey(name: string, value = process.env[name]): Hex {
  if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value) || /^0x0{64}$/i.test(value)) {
    throw new Error(`Missing or invalid ${name}`);
  }
  return value as Hex;
}
