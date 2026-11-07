import { compare, hash } from "bcryptjs";
import type { IHashProvider } from "../IHashProvider";

export class BCryptHashProvider implements IHashProvider {
  generateHash(payload: string): Promise<string> {
    return hash(payload, 10);
  }

  compareHash(payload: string, hashed: string): Promise<boolean> {
    return compare(payload, hashed);
  }
}
