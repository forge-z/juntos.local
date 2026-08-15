# Política de segurança

## Relato responsável

Não publique credenciais, tokens de agente, bancos SQLite ou dados pessoais em
issues. Para vulnerabilidades, abra um contato privado com o mantenedor antes
de criar uma issue pública.

## Primeiro boot

O usuário `admin` / `Admin@123` existe apenas em uma instalação nova. Troque a
senha no assistente inicial antes de cadastrar dados ou expor o serviço na rede.
Por padrão, o Compose escuta somente em `127.0.0.1`; defina `HOST_BIND` apenas
depois do bootstrap e proteja a publicação externa com HTTPS/rede confiável.

O token de agente tem escopo administrativo do lar. A listagem de despesas
omite despesas `individual` pertencentes ao outro usuário, preservando a
privacidade mesmo para integrações MCP/API.
