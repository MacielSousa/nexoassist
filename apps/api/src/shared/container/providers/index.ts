import { container } from "tsyringe";
import type { IHashProvider } from "./HashProvider/IHashProvider";
import { BCryptHashProvider } from "./HashProvider/implementations/BCryptHashProvider";

container.registerSingleton<IHashProvider>("HashProvider", BCryptHashProvider);
