# anime-rss

Agrega lançamentos de anime de sites de torrent e os expõe como feed RSS para o Sonarr.

## Language

**Fonte**:
Site externo de onde lançamentos são extraídos (Erai, Nyaa, Moe).
_Avoid_: site, provider, extrator (quando se refere ao site)

**Varredura**:
Leitura periódica do feed de lançamentos recentes de uma Fonte, sem termo.
_Avoid_: scan (genérico), cron

**Busca por termo**:
Consulta a uma Fonte por um termo vindo do Sonarr, para alcançar lançamentos antigos (histórico).
_Avoid_: pesquisa, query

**Cooldown de termo**:
Período em que um mesmo termo não é buscado de novo na mesma Fonte.
_Avoid_: cache de busca

**Bloqueio da Fonte**:
Estado em que a Fonte recusou o acesso (ex.: firewall do site) e o sistema suspende toda requisição a ela até expirar.
_Avoid_: lock, ban, travamento
