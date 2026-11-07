import { container } from "tsyringe";
import type { IHashProvider } from "./HashProvider/IHashProvider";
import { BCryptHashProvider } from "./HashProvider/implementations/BCryptHashProvider";
import type { IStorageProvider } from "./StorageProvider/IStorageProvider";
import { DiskStorageProvider } from "./StorageProvider/implementations/DiskStorageProvider";

container.registerSingleton<IHashProvider>("HashProvider", BCryptHashProvider);
container.registerSingleton<IStorageProvider>("StorageProvider", DiskStorageProvider);
