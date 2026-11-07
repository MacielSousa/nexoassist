import type { Response } from "express";

/** Abre uma resposta Server-Sent Events e devolve funções para enviar e encerrar. */
export function openSse(response: Response) {
  response.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  response.flushHeaders();
  let open = true;
  response.on("close", () => {
    open = false;
  });
  return {
    send(data: unknown) {
      if (open) response.write(`data: ${JSON.stringify(data)}\n\n`);
    },
    /** Comentário SSE: mantém a conexão viva em proxies. */
    ping() {
      if (open) response.write(": ping\n\n");
    },
    end() {
      if (open) response.end();
      open = false;
    },
    isOpen: () => open,
  };
}
