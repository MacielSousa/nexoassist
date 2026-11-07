import { beforeEach, describe, expect, it } from "vitest";
import { UsersRepositoryInMemory } from "@modules/accounts/repositories/in-memory/UsersRepositoryInMemory";
import { UsersTokensRepositoryInMemory } from "@modules/accounts/repositories/in-memory/UsersTokensRepositoryInMemory";
import { FakeHashProvider } from "@shared/container/providers/HashProvider/in-memory/FakeHashProvider";
import { AppError } from "@shared/errors/AppError";
import { CreateUserUseCase } from "../createUser/CreateUserUseCase";
import { RefreshTokenUseCase } from "../refreshToken/RefreshTokenUseCase";
import { AuthenticateUserUseCase } from "./AuthenticateUserUseCase";

let users: UsersRepositoryInMemory;
let tokens: UsersTokensRepositoryInMemory;
let authenticate: AuthenticateUserUseCase;
let createUser: CreateUserUseCase;

const ana = { name: "Ana Souza", email: "Ana.Souza@nexo.com.br", password: "senha-forte", role: "employee" as const, department: "Financeiro" };

describe("Autenticação", () => {
  beforeEach(() => {
    users = new UsersRepositoryInMemory();
    tokens = new UsersTokensRepositoryInMemory();
    const hash = new FakeHashProvider();
    authenticate = new AuthenticateUserUseCase(users, tokens, hash);
    createUser = new CreateUserUseCase(users, hash);
  });

  it("autentica com e-mail (sem diferenciar maiúsculas) e senha corretos", async () => {
    await createUser.execute(ana);
    const session = await authenticate.execute({ email: "ana.souza@nexo.com.br", password: "senha-forte" });
    expect(session.token).toBeTruthy();
    expect(session.refreshToken).toBeTruthy();
    expect(session.user).not.toHaveProperty("password");
    expect(session.user.initials).toBe("AS");
  });

  it("recusa senha errada com a mesma mensagem de e-mail inexistente", async () => {
    await createUser.execute(ana);
    const wrong = authenticate.execute({ email: ana.email, password: "errada" });
    const missing = authenticate.execute({ email: "ninguem@nexo.com.br", password: "x" });
    await expect(wrong).rejects.toMatchObject({ statusCode: 401, message: "E-mail ou senha incorretos." });
    await expect(missing).rejects.toMatchObject({ statusCode: 401, message: "E-mail ou senha incorretos." });
  });

  it("não autentica usuário desativado", async () => {
    const user = await createUser.execute(ana);
    await users.update(user.id, { active: false });
    await expect(authenticate.execute({ email: ana.email, password: ana.password })).rejects.toMatchObject({ statusCode: 403 });
  });

  it("renova a sessão e invalida o refresh token usado", async () => {
    await createUser.execute(ana);
    const session = await authenticate.execute({ email: ana.email, password: ana.password });
    const refresh = new RefreshTokenUseCase(users, tokens);
    const renewed = await refresh.execute(session.refreshToken);
    expect(renewed.refreshToken).not.toBe(session.refreshToken);
    await expect(refresh.execute(session.refreshToken)).rejects.toBeInstanceOf(AppError);
  });
});
