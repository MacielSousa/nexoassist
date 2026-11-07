import { beforeEach, describe, expect, it } from "vitest";
import type { IActor } from "@modules/accounts/dtos/IActor";
import { UsersRepositoryInMemory } from "@modules/accounts/repositories/in-memory/UsersRepositoryInMemory";
import { UsersTokensRepositoryInMemory } from "@modules/accounts/repositories/in-memory/UsersTokensRepositoryInMemory";
import { UpdateAvatarUseCase } from "@modules/accounts/useCases/updateAvatar/UpdateAvatarUseCase";
import { UpdateProfileUseCase } from "@modules/accounts/useCases/updateProfile/UpdateProfileUseCase";
import { FilesRepositoryInMemory } from "@modules/files/repositories/in-memory/FilesRepositoryInMemory";
import { resolveAttachments } from "@modules/files/utils/resolveAttachments";
import { ConversationsRepositoryInMemory, DraftsRepositoryInMemory, MessagesRepositoryInMemory } from "@modules/support/repositories/in-memory/SupportRepositoriesInMemory";
import { ConversationSnapshot } from "@modules/support/services/ConversationSnapshot";
import { FakeHashProvider } from "@shared/container/providers/HashProvider/in-memory/FakeHashProvider";
import { InMemoryStorageProvider } from "@shared/container/providers/StorageProvider/in-memory/InMemoryStorageProvider";
import { detectFileType } from "@shared/utils/detectFileType";
import { DownloadFileUseCase } from "./downloadFile/DownloadFileUseCase";
import { UploadAttachmentUseCase } from "./uploadAttachment/UploadAttachmentUseCase";
import { StoreUploadUseCase } from "./uploadFile/StoreUploadUseCase";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0]);
const PDF = Buffer.from("%PDF-1.7\n%conteudo de teste");

let users: UsersRepositoryInMemory;
let files: FilesRepositoryInMemory;
let storage: InMemoryStorageProvider;
let store: StoreUploadUseCase;
let conversations: ConversationsRepositoryInMemory;
let snapshot: ConversationSnapshot;
let ana: IActor;
let carla: IActor;
let admin: IActor;

beforeEach(async () => {
  users = new UsersRepositoryInMemory();
  files = new FilesRepositoryInMemory();
  storage = new InMemoryStorageProvider();
  store = new StoreUploadUseCase(files, storage);
  conversations = new ConversationsRepositoryInMemory((id) => users.users.find((u) => u.id === id));
  snapshot = new ConversationSnapshot(conversations, new MessagesRepositoryInMemory(), new DraftsRepositoryInMemory());
  const mk = async (name: string, role: IActor["role"]) => {
    const u = await users.create({ name, email: `${name.toLowerCase()}@nexo.com.br`, password: "hashed:senha-atual", role, department: "TI" });
    return { id: u.id, role };
  };
  ana = await mk("Ana", "employee");
  carla = await mk("Carla", "employee");
  admin = await mk("Admin", "admin");
});

describe("Tipo de arquivo", () => {
  it("reconhece pelo conteúdo, não pela extensão", () => {
    expect(detectFileType(PNG, "foto.pdf")?.mime).toBe("image/png");
    expect(detectFileType(PDF, "relatorio.png")?.mime).toBe("application/pdf");
    expect(detectFileType(Buffer.from("MZ\x90\x00executavel........"), "programa.exe")).toBeNull();
    expect(detectFileType(Buffer.from("a;b\n1;2\n"), "dados.csv")?.mime).toBe("text/csv");
  });
});

describe("Anexos do chat", () => {
  it("salva o anexo e só participantes da conversa baixam", async () => {
    const conversation = await conversations.create(ana.id);
    const upload = new UploadAttachmentUseCase(snapshot, store);
    const file = await upload.execute({ actor: ana, conversationId: conversation.id, originalName: "erro.png", content: PNG });
    expect(file).toMatchObject({ kind: "image", mime: "image/png", name: "erro.png" });

    const download = new DownloadFileUseCase(files, storage, snapshot);
    await expect(download.execute({ actor: ana, fileId: file.id })).resolves.toBeTruthy();
    await expect(download.execute({ actor: carla, fileId: file.id })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("recusa tipo não permitido e anexar arquivo de outra conversa", async () => {
    const mine = await conversations.create(ana.id);
    const other = await conversations.create(carla.id);
    const upload = new UploadAttachmentUseCase(snapshot, store);
    await expect(upload.execute({ actor: ana, conversationId: mine.id, originalName: "x.exe", content: Buffer.from("MZ\x90\x00executavel......") })).rejects.toMatchObject({ statusCode: 415 });
    await expect(upload.execute({ actor: ana, conversationId: other.id, originalName: "a.png", content: PNG })).rejects.toMatchObject({ statusCode: 404 });

    const carlaFile = await upload.execute({ actor: carla, conversationId: other.id, originalName: "a.png", content: PNG });
    await expect(resolveAttachments(files, ana.id, mine.id, [carlaFile.id])).rejects.toMatchObject({ statusCode: 422 });
  });
});

describe("Perfil", () => {
  it("foto: o próprio usuário ou um admin; a foto antiga é apagada", async () => {
    const avatar = new UpdateAvatarUseCase(users, files, storage, store);
    await avatar.update({ actor: ana, userId: ana.id, originalName: "eu.png", content: PNG });
    const second = await avatar.update({ actor: admin, userId: ana.id, originalName: "nova.png", content: PNG });
    expect(second.avatarUrl).toMatch(/^\/files\//);
    expect(files.files).toHaveLength(1);
    expect(storage.files.size).toBe(1);
    await expect(avatar.update({ actor: carla, userId: ana.id, originalName: "x.png", content: PNG })).rejects.toMatchObject({ statusCode: 403 });
    await expect(avatar.update({ actor: ana, userId: ana.id, originalName: "doc.pdf", content: PDF })).rejects.toMatchObject({ statusCode: 415 });
  });

  it("nome livre; trocar e-mail exige a senha atual e encerra sessões", async () => {
    const tokens = new UsersTokensRepositoryInMemory();
    await tokens.create({ userId: ana.id, refreshToken: "r1", expiresAt: new Date(Date.now() + 60_000) });
    const profile = new UpdateProfileUseCase(users, tokens, new FakeHashProvider());

    expect((await profile.execute({ userId: ana.id, name: "Ana Paula Souza" })).name).toBe("Ana Paula Souza");
    await expect(profile.execute({ userId: ana.id, email: "ana.nova@nexo.com.br" })).rejects.toMatchObject({ statusCode: 403 });
    await expect(profile.execute({ userId: ana.id, email: "carla@nexo.com.br", currentPassword: "senha-atual" })).rejects.toMatchObject({ statusCode: 409 });

    const updated = await profile.execute({ userId: ana.id, email: "Ana.Nova@nexo.com.br", currentPassword: "senha-atual" });
    expect(updated.email).toBe("ana.nova@nexo.com.br");
    expect(tokens.tokens).toHaveLength(0);
  });
});
