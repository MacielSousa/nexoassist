import { beforeEach, describe, expect, it } from "vitest";
import { actorOf, type IActor } from "@modules/accounts/dtos/IActor";
import { RolesRepositoryInMemory } from "@modules/accounts/repositories/in-memory/RolesRepositoryInMemory";
import { UsersRepositoryInMemory } from "@modules/accounts/repositories/in-memory/UsersRepositoryInMemory";
import { UsersTokensRepositoryInMemory } from "@modules/accounts/repositories/in-memory/UsersTokensRepositoryInMemory";
import { FakeHashProvider } from "@shared/container/providers/HashProvider/in-memory/FakeHashProvider";
import { AppError } from "@shared/errors/AppError";
import { rateLimiter } from "@shared/infra/http/middlewares/rateLimiter";
import { hashToken } from "../utils/tokens";
import { AuthenticateUserUseCase } from "./authenticateUser/AuthenticateUserUseCase";
import { CreateUserUseCase } from "./createUser/CreateUserUseCase";
import { RefreshTokenUseCase } from "./refreshToken/RefreshTokenUseCase";
import { RolesUseCases } from "./roles/RolesUseCases";
import { SetUserAccessUseCase } from "./setUserAccess/SetUserAccessUseCase";
import { UpdateUserUseCase } from "./updateUser/UpdateUserUseCase";

let roles: RolesRepositoryInMemory;
let users: UsersRepositoryInMemory;
let tokens: UsersTokensRepositoryInMemory;
let hash: FakeHashProvider;
let createUser: CreateUserUseCase;
let updateUser: UpdateUserUseCase;
let setAccess: SetUserAccessUseCase;
let admin: IActor;

beforeEach(async () => {
  roles = new RolesRepositoryInMemory();
  users = new UsersRepositoryInMemory(roles);
  tokens = new UsersTokensRepositoryInMemory();
  hash = new FakeHashProvider();
  createUser = new CreateUserUseCase(users, roles, hash);
  updateUser = new UpdateUserUseCase(users, tokens, hash);
  setAccess = new SetUserAccessUseCase(users, roles);
  admin = await users.createActor("Admin", "admin");
});

const employeeData = () => ({ name: "Ana Souza", email: "Ana.Souza@nexo.com.br", password: "senha-forte", roleIds: [roles.idOf("employee")], department: "Financeiro" });

describe("Autenticação", () => {
  it("autentica (e-mail sem diferenciar maiúsculas) e devolve as permissões das roles", async () => {
    await createUser.execute({ ...employeeData(), actor: admin });
    const session = await new AuthenticateUserUseCase(users, tokens, hash).execute({ email: "ana.souza@nexo.com.br", password: "senha-forte" });
    expect(session.user).not.toHaveProperty("password");
    expect(session.user.roles.map((r) => r.key)).toEqual(["employee"]);
    expect(session.user.permissions).toEqual(expect.arrayContaining(["chat.use", "tickets.create"]));
    expect(session.user.permissions).not.toContain("console.view");
  });

  it("mesma mensagem para senha errada e e-mail inexistente; usuário desativado não entra", async () => {
    const user = await createUser.execute({ ...employeeData(), actor: admin });
    const auth = new AuthenticateUserUseCase(users, tokens, hash);
    await expect(auth.execute({ email: "ana.souza@nexo.com.br", password: "errada" })).rejects.toMatchObject({ statusCode: 401, message: "E-mail ou senha incorretos." });
    await expect(auth.execute({ email: "ninguem@nexo.com.br", password: "x" })).rejects.toMatchObject({ statusCode: 401, message: "E-mail ou senha incorretos." });
    await users.update(user.id, { active: false });
    await expect(auth.execute({ email: "ana.souza@nexo.com.br", password: "senha-forte" })).rejects.toMatchObject({ statusCode: 403 });
  });

  it("renova a sessão e invalida o refresh token usado", async () => {
    await createUser.execute({ ...employeeData(), actor: admin });
    const session = await new AuthenticateUserUseCase(users, tokens, hash).execute({ email: "ana.souza@nexo.com.br", password: "senha-forte" });
    const refresh = new RefreshTokenUseCase(users, tokens);
    expect((await refresh.execute(session.refreshToken)).refreshToken).not.toBe(session.refreshToken);
    await expect(refresh.execute(session.refreshToken)).rejects.toBeInstanceOf(AppError);
  });

  it("o banco guarda só o hash do refresh token", async () => {
    await createUser.execute({ ...employeeData(), actor: admin });
    const session = await new AuthenticateUserUseCase(users, tokens, hash).execute({ email: "ana.souza@nexo.com.br", password: "senha-forte" });
    const stored = tokens.tokens.at(-1)!.refreshToken;
    expect(stored).not.toBe(session.refreshToken);
    expect(stored).toBe(hashToken(session.refreshToken));
  });

  it("e-mail inexistente também passa pela comparação de senha (sem atalho de tempo)", async () => {
    let comparisons = 0;
    const counting = Object.assign(Object.create(hash), { compareHash: (p: string, h: string) => (comparisons++, hash.compareHash(p, h)) });
    await expect(new AuthenticateUserUseCase(users, tokens, counting).execute({ email: "ninguem@nexo.com.br", password: "x" })).rejects.toMatchObject({ statusCode: 401 });
    expect(comparisons).toBe(1);
  });
});

describe("Limite de tentativas", () => {
  it("bloqueia com 429 depois do máximo, por chave", () => {
    const limiter = rateLimiter({ windowMs: 60_000, max: 2, key: (r) => String(r.body.email) });
    const call = (email: string) => limiter({ body: { email } } as never, { setHeader: () => undefined } as never, () => undefined);
    call("a");
    call("a");
    expect(() => call("a")).toThrow(expect.objectContaining({ statusCode: 429 }));
    expect(() => call("b")).not.toThrow();
  });
});

describe("Cadastro de usuários", () => {
  it("não permite e-mail duplicado e guarda a senha só como hash", async () => {
    const ana = await createUser.execute({ ...employeeData(), actor: admin });
    expect((await users.findById(ana.id))?.password).toBe("hashed:senha-forte");
    await expect(createUser.execute({ ...employeeData(), email: "ANA.SOUZA@nexo.com.br", actor: admin })).rejects.toMatchObject({ statusCode: 409 });
  });

  it("quem atende no console precisa de fila; para os demais a fila é ignorada", async () => {
    const base = { name: "Rafael Lima", email: "rafael@nexo.com.br", password: "12345678", department: "TI" };
    await expect(createUser.execute({ ...base, roleIds: [roles.idOf("analyst")], actor: admin })).rejects.toMatchObject({ statusCode: 400 });
    const employee = await createUser.execute({ ...base, roleIds: [roles.idOf("employee")], team: "Suporte N2", actor: admin });
    expect(employee.team).toBeNull();
  });

  it("desativar encerra as sessões; ninguém se desativa nem altera o próprio acesso", async () => {
    const ana = await createUser.execute({ ...employeeData(), actor: admin });
    await tokens.create({ userId: ana.id, refreshToken: "r1", expiresAt: new Date(Date.now() + 60_000) });
    expect((await updateUser.execute({ id: ana.id, actor: admin, active: false })).active).toBe(false);
    expect(tokens.tokens).toHaveLength(0);
    await expect(updateUser.execute({ id: admin.id, actor: admin, active: false })).rejects.toMatchObject({ statusCode: 400 });
    await expect(setAccess.execute({ actor: admin, userId: admin.id, roleIds: [roles.idOf("employee")], permissions: [] })).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("Roles e permissões", () => {
  it("cria uma role com permissões escolhidas e atribui a um usuário", async () => {
    const rolesUseCases = new RolesUseCases(roles, users);
    const role = await rolesUseCases.create({ actor: admin, name: "Supervisão", description: "Vê relatórios", permissions: ["reports.view", "console.view"] });
    expect(role).toMatchObject({ key: "supervisao", isSystem: false, permissions: ["reports.view", "console.view"] });

    const user = await createUser.execute({ ...employeeData(), roleIds: [role.id], actor: admin });
    expect(user.permissions.sort()).toEqual(["console.view", "reports.view"]);
    await expect(rolesUseCases.delete(role.id)).rejects.toMatchObject({ statusCode: 409 }); // tem usuário
  });

  it("macro e micro: várias roles somadas às permissões diretas", async () => {
    const supervisao = await new RolesUseCases(roles, users).create({ actor: admin, name: "Supervisão", description: "", permissions: ["reports.view"] });
    const ana = await createUser.execute({ ...employeeData(), actor: admin });

    const updated = await setAccess.execute({ actor: admin, userId: ana.id, roleIds: [roles.idOf("employee"), supervisao.id], permissions: ["users.view"] });
    expect(updated.roles.map((r) => r.key).sort()).toEqual(["employee", "supervisao"]);
    expect(updated.directPermissions).toEqual(["users.view"]);
    expect(updated.permissions).toEqual(expect.arrayContaining(["chat.use", "reports.view", "users.view"]));

    // Tirar a role tira as permissões dela; a direta continua.
    const back = await setAccess.execute({ actor: admin, userId: ana.id, roleIds: [roles.idOf("employee")], permissions: ["users.view"] });
    expect(back.permissions).not.toContain("reports.view");
    expect(back.permissions).toContain("users.view");
  });

  it("dar acesso ao console exige fila; tirar o console limpa a fila", async () => {
    const ana = await createUser.execute({ ...employeeData(), actor: admin });
    await expect(setAccess.execute({ actor: admin, userId: ana.id, roleIds: [roles.idOf("employee")], permissions: ["console.attend"] })).rejects.toMatchObject({ statusCode: 400 });
    const analyst = await setAccess.execute({ actor: admin, userId: ana.id, roleIds: [roles.idOf("employee")], permissions: ["console.attend"], team: "Suporte N1" });
    expect(analyst.team).toBe("Suporte N1");
    expect((await setAccess.execute({ actor: admin, userId: ana.id, roleIds: [roles.idOf("employee")], permissions: [] })).team).toBeNull();
  });

  it("sem escalada: quem gerencia usuários não concede o que não tem, nem por role nem direto", async () => {
    // Gestor de usuários sem roles.manage nem reports.view
    const gestorRole = await new RolesUseCases(roles, users).create({ actor: admin, name: "Gestor de usuários", description: "", permissions: ["users.manage", "users.view"] });
    const gestor = actorOf((await users.findById((await createUser.execute({ ...employeeData(), roleIds: [gestorRole.id], actor: admin })).id))!);
    const bia = await createUser.execute({ ...employeeData(), email: "bia@nexo.com.br", name: "Bia", actor: admin });
    const employeeRole = roles.idOf("employee");

    await expect(setAccess.execute({ actor: gestor, userId: bia.id, roleIds: [employeeRole], permissions: ["reports.view"] })).rejects.toMatchObject({ statusCode: 403 });
    await expect(setAccess.execute({ actor: gestor, userId: bia.id, roleIds: [employeeRole, roles.idOf("admin")], permissions: [] })).rejects.toMatchObject({ statusCode: 403 });
    // Manter o que a pessoa já tinha não é conceder nada novo.
    await expect(setAccess.execute({ actor: gestor, userId: bia.id, roleIds: [employeeRole], permissions: ["users.view"] })).resolves.toBeTruthy();
  });

  it("não deixa o sistema sem ninguém que gerencie roles e usuários", async () => {
    const rolesUseCases = new RolesUseCases(roles, users);
    await expect(rolesUseCases.update({ actor: admin, id: roles.idOf("admin"), permissions: ["reports.view"] })).rejects.toMatchObject({ statusCode: 409 });
    // a mudança foi desfeita
    expect((await roles.findByKey("admin"))!.permissions.map((p) => p.key)).toContain("roles.manage");
    await expect(rolesUseCases.delete(roles.idOf("employee"))).rejects.toMatchObject({ statusCode: 409 }); // role de sistema

    // Outro admin tirando a role de admin do único admin: desfeito.
    const gestorRole = await rolesUseCases.create({ actor: admin, name: "Gestor", description: "", permissions: ["users.manage", "chat.use", "tickets.view_own", "tickets.create"] });
    const gestor = actorOf((await users.findById((await createUser.execute({ ...employeeData(), roleIds: [gestorRole.id], actor: admin })).id))!);
    await expect(setAccess.execute({ actor: gestor, userId: admin.id, roleIds: [roles.idOf("employee")], permissions: [] })).rejects.toMatchObject({ statusCode: 409 });
    expect((await users.findById(admin.id))!.roles.map((r) => r.key)).toEqual(["admin"]);
  });
});
