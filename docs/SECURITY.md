# Segurança

Resumo das proteções do Nexo Assist e do que foi revisado na autoanálise de segurança.

## Autenticação e sessão

- Senhas com bcrypt; a API nunca devolve o hash (`UserMap`).
- Token de acesso JWT (HS256 fixo) de 15 min, só com o `sub`; `JWT_SECRET` com no mínimo 32 caracteres (a API não sobe sem ele).
- O token só é aceito no header `Authorization`, nunca na URL (URLs acabam em logs).
- Refresh token opaco de 256 bits, rotacionado a cada uso; o banco guarda **só o SHA-256** dele.
- No navegador, os tokens ficam em cookies `httpOnly` + `SameSite=Lax` (+ `Secure` em produção). O JavaScript da página nunca vê o JWT.
- Permissões lidas do banco a cada requisição: desativar alguém ou tirar uma permissão vale na hora.
- Login com a mesma mensagem **e o mesmo tempo** para e-mail inexistente e senha errada (sem enumeração de contas).
- Trocar senha ou e-mail exige a senha atual e encerra as outras sessões.

## Limites de tentativas

| Onde | Limite |
| --- | --- |
| `POST /sessions` (login) | 10 por e-mail a cada 15 min (independe do IP) + 50 por IP |
| Troca de senha / e-mail | 10 por usuário a cada 15 min |
| API em geral | 300 por IP por minuto |
| Chat | 30 mensagens por conversa; uma resposta do agent por vez |

O web repassa o IP do usuário à API (`X-Forwarded-For`). **Em produção**, coloque um proxy reverso (nginx, load balancer) que sobrescreva esse header: sem ele, o cliente pode forjar o IP, por isso o limite de login é por conta, não por IP.

## Autorização (RBAC)

- Acesso = roles (macro) + permissões diretas (micro). Toda rota declara as permissões exigidas (`defineRoute`), e os use cases conferem de novo.
- Sem escalada de privilégio: só se concede (por role ou direto) o que você mesmo tem, salvo quem tem `roles.manage`.
- Ninguém altera o próprio acesso nem se desativa; o sistema nunca fica sem alguém com `users.manage` e `roles.manage` (a alteração é desfeita).
- Recursos de outra pessoa respondem **404**, sem revelar que existem: chamados (`findVisibleTicket`), conversas (`ConversationSnapshot.findVisible`), anexos e rascunhos.
- O agent recebe a identidade pelo contexto da requisição (do token), nunca do texto do LLM: uma injeção de prompt não faz o agent agir em nome de outra pessoa.

## Arquivos

- Tipo detectado pelos bytes do arquivo (não pela extensão); lista fechada de tipos e limites por tipo (imagem 5 MB, vídeo 25 MB, documento 10 MB).
- Nome higienizado; armazenamento com chave aleatória (nada do nome do usuário no caminho).
- Download com `X-Content-Type-Options: nosniff`, `Content-Security-Policy: sandbox` e `Content-Disposition` codificado; anexos só para quem vê a conversa.

## Web e cabeçalhos

- Páginas: CSP `frame-ancestors 'none'` (anti-clickjacking), `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- API: `nosniff`, `X-Frame-Options`, `Referrer-Policy: no-referrer`, HSTS; `x-powered-by` desligado; CORS restrito a `CORS_ORIGIN`.
- Proxy `/api/*` do web: confere a origem em POST/PUT/PATCH/DELETE (CSRF, além do SameSite) e repassa os cabeçalhos de segurança da API.
- Entradas validadas com zod (campos desconhecidos descartados); SQL sempre parametrizado; CSV de relatórios protegido contra injeção de fórmulas.
- Erros inesperados viram 500 genérico, sem stack trace na resposta.

## Pontos de atenção (conhecidos)

- **Contas de demonstração**: o seed cria usuários com a senha `SEED_PASSWORD` (padrão `nexo1234`), e o login mostra atalhos para elas quando `DEMO_MODE=true` (ligado no `docker-compose.yml` para a avaliação). Em produção real: desligue `DEMO_MODE`, defina `SEED_PASSWORD` ou não rode o seed, e troque `JWT_SECRET`.
- **Logout e token de acesso**: o logout invalida o refresh token na hora; o JWT de acesso já emitido vale até expirar (no máximo 15 min). Desativar o usuário corta o acesso imediatamente.
- **Limites em memória**: valem por instância. Com várias instâncias, troque por Redis.
- **`npm audit`**: 3 alertas moderados em `glob`/`minimatch`, dependências do TypeORM usadas só para carregar entidades na inicialização (sem entrada de usuário). A correção exige o TypeORM 1.x (mudança grande); fica para uma atualização planejada.
