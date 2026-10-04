# Segunda vertical slice — programação de cargas

## Resultado funcional

Um usuário autorizado programa uma carga para um contrato ativo. O sistema interpreta data e hora no fuso configurado pelo tenant, reserva o saldo do contrato e disponibiliza agenda e detalhe para a execução operacional.

## Dentro desta entrega

- Entidade `app.loads` isolada por tenant com RLS habilitada e forçada.
- Grant explícito e restrito da tabela para o papel de runtime da API.
- Capability `OPERATIONS_EDIT` separada das permissões comerciais.
- Programação vinculada a contrato ativo.
- Validação da janela contratual no fuso do tenant.
- Reserva de peso com base em `quantidade_sc × 60 kg`.
- Rejeição transacional de programação acima do saldo disponível.
- Auditoria e outbox `load.scheduled` na mesma transação.
- Agenda por contrato e consulta do detalhe da carga.

## Extensões já entregues

- Check-in, fila de pátio, chamada para balança, liberação e saída em sequência auditável.
- Pesagem bruta, tara, peso documental, de chegada, considerado e aceito sem tolerância presumida.
- Classificação explícita e versionamento do recebimento.
- Ocorrências operacionais com severidade, abertura e resolução preservadas na auditoria.
- Romaneio operacional versionado e emitido somente a partir do recebimento aceito.
- Entrada ou correção compensatória no livro de estoque.
- Cancelamento ou reprogramação de carga.

## Fora desta entrega

- Regra automática de descontos de qualidade, pendente de homologação do piloto.
- Escrituração e validação fiscal da NF-e de entrada; o recebimento conserva apenas a referência operacional.
- Liquidação financeira da compra.

## Contratos HTTP

### `POST /v1/contracts/:contractId/loads`

```json
{
  "scheduledLocal": "2026-10-15T08:30",
  "expectedWeightKg": "48000.000",
  "vehiclePlate": "ABC1D23",
  "carrierName": "Transportadora Exemplo",
  "destinationCode": "ARMAZEM-SORRISO"
}
```

`scheduledLocal` não aceita offset: a API aplica o fuso IANA do tenant. Valores decimais são enviados como string e o banco mantém `numeric(20,3)`.

### `GET /v1/contracts/:contractId/loads`

Retorna `items` e `summary`, incluindo peso programado, recebido e disponível.

### `GET /v1/loads/:loadId`

Retorna a programação com instante UTC e o identificador do fuso do tenant para apresentação consistente.

## Invariantes

1. Toda carga pertence ao mesmo tenant do contrato.
2. Apenas membro ativo com `OPERATIONS_EDIT` cria programação.
3. Leituras exigem membership ativa e permanecem limitadas pelo contexto transacional e pela RLS.
4. Carga não cancelada consome saldo previsto do contrato.
5. O bloqueio do contrato e a soma das cargas acontecem na mesma transação para impedir excesso concorrente.
6. O evento de domínio e a auditoria são gravados atomicamente com a carga.

## Próxima extensão

Recebimento e pesagem: check-in da carga, peso bruto, tara, peso líquido calculado, origem do dado (balança ou contingência manual), motivo obrigatório na contingência e trilha imutável.
