/// <reference path="../pb_data/types.d.ts" />

// Limite de tentativas (rate limit) do PocketBase, por endereço de rede (IP):
// - login com senha: 10 tentativas por minuto. Sem isso, dava para testar senhas sem parar numa matrícula de 5 dígitos;
// - o resto fica nos padrões do PocketBase (folgados para o uso normal: 300 requisições a cada 10 s por IP).
// O próprio PC servidor (127.0.0.1) fica de fora: as ferramentas de teste e o painel /_/ rodam nele.
// Excedeu: o servidor responde 429 e o front mostra "Muitas tentativas. Espere um minuto".

const REGRA = { label: "users:authWithPassword", audience: "", duration: 60, maxRequests: 10 };

migrate((app) => {
  const s = app.settings();
  const regras = s.rateLimits.rules.filter((r) => r.label !== REGRA.label);
  s.rateLimits.rules = [...regras, REGRA];
  s.rateLimits.enabled = true;
  const fora = s.rateLimits.excludedIPs || [];
  for (const ip of ["127.0.0.1", "::1"]) if (!fora.includes(ip)) fora.push(ip);
  s.rateLimits.excludedIPs = fora;
  app.save(s);
}, (app) => {
  const s = app.settings();
  s.rateLimits.rules = s.rateLimits.rules.filter((r) => r.label !== REGRA.label);
  s.rateLimits.enabled = false;
  app.save(s);
});
