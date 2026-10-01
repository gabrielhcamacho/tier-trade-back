# ADR 0001 — Monólito modular no primeiro ciclo

Status: aceito em 2026-10-01.

O backend começa como um monólito modular NestJS sobre Fastify. Os limites internos seguem os contextos de domínio, os dados pertencem a um único módulo e a comunicação que puder atravessar processos nasce como evento versionado. A separação em serviços só ocorrerá por evidência de escala, isolamento operacional ou autonomia de equipe.

Fundamentação: “Arquitetura Futura e Princípios de Domínio” 1.2 e “Arquitetura de Multitenancy, Dados e Implantação” 1.1.
