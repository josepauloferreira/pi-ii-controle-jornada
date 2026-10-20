import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBackup } from '../src/lib/backup.js';
const record = { entrada: '22:00', saidaAlmoco: null, retornoAlmoco: null, saida: '06:00', extras: [{ horario: '07:00', descricao: 'Fictício' }] };
const backup = { registros: { '2026-10-15': record }, configuracoes: { nome: 'Fictício', jornada: '08:00', inicioSemana: '1' } };
test('backup legado e noturno não exige justificativa nem altera dados', () => {
  const output = validateBackup({ ...backup, versao: 1, justificativa: 'legado' });
  assert.deepEqual(output, backup);
  assert.deepEqual(output.registros['2026-10-15'], record);
  assert.deepEqual(validateBackup({ registros: {} }), { registros: {} });
});
test('backup rejeita estrutura, datas, horários e extras inválidos', () => {
  for (const input of [null, [], {}, { registros: [] }, { registros: { '2026-02-30': record } }, { registros: { '2026-10-15': { ...record, entrada: '24:00' } } }, { registros: { '2026-10-15': { ...record, saida: undefined } } }, { registros: { '2026-10-15': { ...record, extras: [{ horario: '08:00', descricao: 42 }] } } }]) assert.throws(() => validateBackup(input));
});
test('backup valida configurações e snapshots sem reescrever sua origem', () => {
  const value = { ...backup, jornadasPrevistas: { '2026-10-15': { minutos: 420, origem: 'registrada' } } };
  assert.deepEqual(validateBackup(value), value);
  for (const value of [null, [], { '2026-10-16': { minutos: 480 } }, { '2026-10-15': { minutos: 1440 } }, { '2026-10-15': { minutos: 1.5 } }, { '2026-10-15': { minutos: 480, origem: 'inventado' } }]) assert.throws(() => validateBackup({ ...backup, jornadasPrevistas: value }));
  for (const value of [null, [], { ...backup.configuracoes, jornada: '8:00' }, { ...backup.configuracoes, inicioSemana: 1 }]) assert.throws(() => validateBackup({ ...backup, configuracoes: value }));
});
