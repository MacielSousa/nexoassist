import { beforeEach, describe, expect, it } from "vitest";
import { UsersRepositoryInMemory } from "@modules/accounts/repositories/in-memory/UsersRepositoryInMemory";
import { UsersTokensRepositoryInMemory } from "@modules/accounts/repositories/in-memory/UsersTokensRepositoryInMemory";
import { FakeHashProvider } from "@shared/container/providers/HashProvider/in-memory/FakeHashProvider";
import { CreateUserUseCase } from "../createUser/CreateUserUseCase";
import { UpdateUserUseCase } from "./UpdateUserUseCase";

let users: UsersRepositoryInMemory;
let tokens: UsersTokensRepositoryInMemory;
let createUser: CreateUserUseCase;
let updateUser: UpdateUserUseCase;

describe("Cadastro de usuários (admin)", () => {
  beforeEach(() => {
    users = new UsersRepositoryInMemory();
    tokens = new UsersTokensRepositoryInMemory();
    const hash = new FakeHashProvider();
    createUser = new CreateUserUseCase(users, hash);
    updateUser = new UpdateUserUseCase(users, tokens, hash);
  });

  it("não permite e-mail duplicado", async () => {
    const data = { name: "Ana Souza", email: "ana@nexo.com.br", password: "12345678", role: "employee" as const, department: "TI" };
    await createUser.execute(data);
    await expect(createUser.execute({ ...data, email: "ANA@nexo.com.br" })).rejects.toMatchObject({ statusCode: 409 });
  });

  it("exige a fila do analista e ignora fila para funcionários", async () => {
    const base = { name: "Rafael Lima", email: "rafael@nexo.com.br", password: "12345678", department: "TI" };
    await expect(createUser.execute({ ...base, role: "analyst" })).rejects.toMatchObject({ statusCode: 400 });
    const employee = await createUser.execute({ ...base, role: "employee", team: "Suporte N2" });
    expect(employee.team).toBeNull();
  });

  it("guarda a senha só como hash", async () => {
    const user = await createUser.execute({ name: "Júlia Costa", email: "julia@nexo.com.br", password: "12345678", role: "analyst", team: "Suporte N1", department: "TI" });
    expect((await users.findById(user.id))?.password).toBe("hashed:12345678");
  });

  it("desativar encerra as sessões e o admin não pode se desativar", async () => {
    const admin = await createUser.execute({ name: "Admin", email: "admin@nexo.com.br", password: "12345678", role: "admin", department: "TI" });
    const ana = await createUser.execute({ name: "Ana", email: "ana@nexo.com.br", password: "12345678", role: "employee", department: "TI" });
    await tokens.create({ userId: ana.id, refreshToken: "r1", expiresAt: new Date(Date.now() + 60_000) });

    const updated = await updateUser.execute({ id: ana.id, actorId: admin.id, active: false });
    expect(updated.active).toBe(false);
    expect(tokens.tokens).toHaveLength(0);

    await expect(updateUser.execute({ id: admin.id, actorId: admin.id, active: false })).rejects.toMatchObject({ statusCode: 400 });
  });
});
