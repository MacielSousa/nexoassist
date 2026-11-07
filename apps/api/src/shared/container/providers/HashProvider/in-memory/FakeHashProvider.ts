import type { IHashProvider } from "../IHashProvider";

/** Hash falso e rápido para testes. */
export class FakeHashProvider implements IHashProvider {
  async generateHash(payload: string) {
    return `hashed:${payload}`;
  }

  async compareHash(payload: string, hashed: string) {
    return hashed === `hashed:${payload}`;
  }
}
