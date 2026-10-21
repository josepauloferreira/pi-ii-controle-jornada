import { request } from '../lib/api.js';
import { escape, fields, labels, dateLabel, timestampLabel, emptyRecord } from '../lib/format.js';
import { metrics, timeline, button, icon, timeField, reasonField, passwordField, badge } from './components.js';
import { openDialog, cancelButton } from './dialog.js';
import { disableMigrationOffer } from '../lib/legacy.js';
import { validateForm, fieldError } from './forms.js';

export function createJourneyDialogs({ getState, refresh, notify, afterPassword }) {
  let detail = null;
  const extrasViews = new Set();
  const dateAttrs = date => `data-date="${date}"`;
  const submit = (label, form, danger = false) => `<button type="submit" form="${form}" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-submit>${escape(label)}</button>`;
  const reason = (dialog, id) => {
    const value = dialog.query('#' + id).value.trim();
    if (value.length < 10 || value.length > 500) throw new Error('A justificativa precisa ter entre 10 e 500 caracteres, sem contar espaços nas extremidades.');
    return value;
  };
  async function save(dialog, work, message) {
    dialog.setBusy(true);
    try {
      await work();
      if (!getState().user) return;
      const updated = await refresh();
      refreshOpenViews();
      dialog.setBusy(false);
      dialog.close();
      notify(updated ? message : message + ' Não foi possível recarregar os dados; use Tentar novamente.');
    } catch (error) {
      dialog.setBusy(false);
      if (dialog.element.isConnected) dialog.error(error.message);
    }
  }
  function detailsBody(date) {
    const state = getState();
    const r = state.records[date];
    return `${r ? badge(r) : '<p class="notice">Esta jornada foi excluída. A auditoria permanece disponível.</p>'}${r ? metrics(state, date) + '<h3>Marcações registradas</h3>' + timeline(r) : ''}
      <div class="dialog-section"><h3>Origem e alterações</h3><div data-origin role="status">Carregando histórico…</div>${button('Histórico de alterações', 'audit', 'history', 'btn-link', dateAttrs(date))}</div>
      <div class="page-actions">${button('Gerenciar batidas extras', 'extras', 'plus', '', dateAttrs(date))}${button('Excluir registro', 'delete-record', 'trash', 'danger', `${dateAttrs(date)} ${r ? '' : 'disabled'}`)}</div>`;
  }
  async function loadOrigin(dialog, date) {
    try {
      const audit = await request('/api/jornada/historico/' + date);
      if (!dialog.element.isConnected) return;
      const target = dialog.query('[data-origin]');
      if (!target) return;
      target.textContent = `${audit.origem === 'servidor' ? 'Há marcações originais registradas pelo servidor.' : 'Sem marcações originais de servidor: registro importado ou corrigido manualmente.'} ${audit.alteracoes.length} evento(s) no histórico.`;
    } catch (error) {
      if (dialog.element.isConnected && dialog.query('[data-origin]')) dialog.query('[data-origin]').textContent = error.message;
    }
  }
  function openDetails(date) {
    const dialog = openDialog({ title: 'Detalhes da jornada', description: dateLabel(date, true), drawer: true,
      body: detailsBody(date), footer: `${button('Corrigir horários', 'edit', 'edit', 'btn-primary', dateAttrs(date))}<button type="button" class="btn" data-close>Fechar detalhes</button>`,
      onClose: () => { if (detail?.dialog === dialog) detail = null; }
    });
    detail = { dialog, date };
    void loadOrigin(dialog, date);
  }
  function extraList(date) {
    const extras = getState().records[date]?.extras || [];
    return extras.length ? `<ul class="extra-list">${extras.map((e, i) => `<li><div class="extra-copy"><strong class="time">${escape(e.horario)}</strong><p>${escape(e.descricao || 'Batida extra')}</p></div><div class="extra-actions">${button('', 'edit-extra', 'edit', 'icon-button', `${dateAttrs(date)} data-index="${i}" aria-label="Editar batida extra das ${escape(e.horario)}"`)}${button('', 'delete-extra', 'trash', 'icon-button danger', `${dateAttrs(date)} data-index="${i}" aria-label="Excluir batida extra das ${escape(e.horario)}"`)}</div></li>`).join('')}</ul>` : '<p class="muted">Nenhuma batida extra registrada.</p>';
  }
  function refreshOpenViews() {
    if (detail?.dialog.element.isConnected) {
      detail.dialog.query('.dialog-body').innerHTML = detailsBody(detail.date) + '<p class="form-error" role="alert" data-dialog-error></p>';
      detail.dialog.query('.dialog-footer [data-action="edit"]').disabled = !getState().records[detail.date];
      void loadOrigin(detail.dialog, detail.date);
    }
    for (const item of extrasViews) if (item.dialog.element.isConnected) {
      const list = item.dialog.query('[data-extra-list]');
      if (list) list.innerHTML = extraList(item.date);
    }
  }
  function openEdit(date, field) {
    const original = getState().records[date];
    if (!original) return notify('Este registro não está disponível. Atualize os dados.');
    let selected = fields.includes(field) ? field : fields.find(f => original[f]) || 'entrada';
    const dialog = openDialog({ id: 'modalEdicao', title: 'Corrigir marcação', description: dateLabel(date, true),
      body: `<form id="correctionForm"><fieldset class="plain-fieldset"><legend>Marcação a ser corrigida</legend><div class="correction-tabs">${fields.map((f, i) => `<label><input type="radio" name="campo" value="${f}" ${selected === f ? 'checked' : ''}>${labels[i]}</label>`).join('')}</div></fieldset><p class="current-value">Horário atual: <strong id="currentTime">${escape(original[selected] || 'Não registrado')}</strong></p>${timeField('editHorario', 'Novo horário', original[selected] || '', true)}${reasonField('editReason')}</form>`,
      footer: cancelButton + submit('Salvar correção', 'correctionForm'), initialFocus: '#editHorario'
    });
    dialog.query('.correction-tabs').addEventListener('change', event => {
      selected = event.target.value;
      dialog.query('#editHorario').value = original[selected] || '';
      dialog.query('#currentTime').textContent = original[selected] || 'Não registrado';
    });
    dialog.query('form').addEventListener('submit', event => {
      event.preventDefault();
      void save(dialog, async () => {
        const justificativa = reason(dialog, 'editReason');
        const registro = { ...getState().records[date], [selected]: dialog.query('#editHorario').value };
        await request('/api/registros/' + date, { method: 'PUT', data: { ...registro, justificativa } });
      }, 'Correção salva e registrada na auditoria.');
    });
  }
  function openDelete(date, { field, index } = {}) {
    const original = getState().records[date];
    if (!original) return notify('Este registro não está disponível. Atualize os dados.');
    const extra = Number.isInteger(index);
    const title = field ? `Excluir ${labels[fields.indexOf(field)].toLowerCase()}?` : extra ? 'Excluir batida extra?' : 'Excluir registro?';
    const dialog = openDialog({ id: 'modalExclusao', title, description: dateLabel(date, true),
      body: `<form id="deleteForm"><p>${field || extra ? 'Apenas a marcação selecionada será removida.' : 'Todas as marcações desta jornada serão removidas do histórico.'}</p><div class="dialog-section">${reasonField('deleteReason', 'Justificativa da exclusão')}</div><p class="notice">${icon('info')}A exclusão, os valores anteriores e sua justificativa permanecerão na auditoria.</p></form>`,
      footer: cancelButton + submit('Confirmar exclusão', 'deleteForm', true), initialFocus: '[data-close]'
    });
    dialog.query('form').addEventListener('submit', event => {
      event.preventDefault();
      void save(dialog, async () => {
        const justificativa = reason(dialog, 'deleteReason');
        const current = getState().records[date];
        const record = structuredClone(current);
        if (field) record[field] = null;
        if (extra) record.extras.splice(index, 1);
        const keep = (field || extra) && (fields.some(f => record[f]) || record.extras.length);
        await request('/api/registros/' + date, { method: keep ? 'PUT' : 'DELETE', data: keep ? { ...record, justificativa } : { justificativa } });
      }, 'Exclusão salva. A auditoria continua disponível.');
    });
  }
  function openExtras(date, index = null) {
    const original = getState().records[date]?.extras?.[index];
    if (index !== null && !original) return notify('A batida extra não está mais disponível.');
    const dialog = openDialog({ id: index === null ? 'modalExtra' : 'editarExtra', title: index === null ? 'Gerenciar batidas extras' : 'Editar batida extra', description: dateLabel(date, true),
      body: `${index === null ? `<div data-extra-list>${extraList(date)}</div><h3 class="dialog-section">Adicionar batida</h3><p class="field-help">Registros adicionais não alteram as horas trabalhadas.</p>` : ''}<form id="extraForm${index === null ? '' : 'Edit'}" class="dialog-section">${timeField('horarioExtra' + (index === null ? '' : 'Edit'), 'Horário da batida', original?.horario || '', true)}<div class="field"><label for="descricaoExtra${index === null ? '' : 'Edit'}">Descrição <span class="muted">(opcional)</span></label><input id="descricaoExtra${index === null ? '' : 'Edit'}" type="text" value="${escape(original?.descricao || '')}"></div>${reasonField('extraReason' + (index === null ? '' : 'Edit'))}</form>`,
      footer: cancelButton + submit(index === null ? 'Adicionar batida' : 'Salvar batida', 'extraForm' + (index === null ? '' : 'Edit')),
      onClose: () => { extrasViews.delete(item); }
    });
    const item = { dialog, date };
    extrasViews.add(item);
    dialog.query('form').addEventListener('submit', event => {
      event.preventDefault();
      void save(dialog, async () => {
        const suffix = index === null ? '' : 'Edit';
        const justificativa = reason(dialog, 'extraReason' + suffix);
        const record = structuredClone(getState().records[date] || emptyRecord());
        const updated = { horario: dialog.query('#horarioExtra' + suffix).value, descricao: dialog.query('#descricaoExtra' + suffix).value.trim() || 'Batida extra' };
        if (index === null) record.extras.push(updated);
        else record.extras[index] = updated;
        await request('/api/registros/' + date, { method: 'PUT', data: { ...record, justificativa } });
      }, 'Batida extra salva e registrada na auditoria.');
    });
  }
  function auditDiff(item) {
    const changes = fields.flatMap((f, i) => item.antes?.[f] === item.depois?.[f] ? [] : [`<p><strong>${labels[i]}:</strong> <span class="numeric">${escape(item.antes?.[f] || 'Sem marcação')} ${icon('arrow')} ${escape(item.depois?.[f] || 'Sem marcação')}</span></p>`]);
    if (JSON.stringify(item.antes?.extras || []) !== JSON.stringify(item.depois?.extras || [])) {
      const show = extras => extras?.map(e => `${e.horario} ${e.descricao || 'Batida extra'}`).join('; ') || 'Nenhuma';
      changes.push(`<p><strong>Batidas extras:</strong> ${escape(show(item.antes?.extras))} ${icon('arrow')} ${escape(show(item.depois?.extras))}</p>`);
    }
    return changes.length ? `<div class="audit-diff">${changes.join('')}</div>` : '';
  }
  function openAudit(date) {
    const dialog = openDialog({ title: 'Histórico de alterações', description: dateLabel(date, true), drawer: true,
      body: '<p role="status">Carregando eventos da jornada…</p>', footer: '<button class="btn" type="button" data-close>Concluir visualização</button>'
    });
    async function load() {
      try {
        const data = await request('/api/jornada/historico/' + date);
        if (!dialog.element.isConnected) return;
        const operation = { marcacao: 'Marcação pelo servidor', correcao: 'Correção de registro', exclusao: 'Exclusão de registro', restauracao: 'Restauração de backup' };
        dialog.query('.dialog-body').innerHTML = data.alteracoes.length
          ? `<p class="field-help">Eventos do mais recente ao mais antigo. Histórico somente para consulta.</p><ol class="audit-list">${[...data.alteracoes].reverse().map(item => `<li class="audit-event"><div class="audit-event-header"><h3>${escape(operation[item.operacao] || item.operacao)}</h3><time datetime="${escape(item.instante)}">${escape(timestampLabel(item.instante))} · Brasília</time></div>${auditDiff(item)}<p class="audit-reason">${escape(item.justificativa)}</p></li>`).join('')}</ol>`
          : '<div class="empty-state"><h3>Nenhuma alteração registrada.</h3><p>Quando houver marcações, correções, exclusões ou restaurações nesta data, os eventos aparecerão aqui.</p></div>';
      } catch (error) {
        if (!dialog.element.isConnected) return;
        dialog.query('.dialog-body').innerHTML = `<p class="form-error" role="alert">${escape(error.message)}</p><button type="button" class="btn" data-retry>Tentar novamente</button>`;
        dialog.query('[data-retry]').addEventListener('click', () => void load());
      }
    }
    void load();
  }
  function openPassword() {
    const dialog = openDialog({ id: 'senhaModal', title: 'Alterar senha', description: 'Ao salvar, as sessões serão encerradas. Entre novamente com a nova senha.',
      body: `<form id="senhaForm" novalidate><input type="text" name="username" autocomplete="username" value="${escape(getState().user)}" hidden>${passwordField('senhaAtual', 'Senha atual', 'current-password')}${passwordField('senhaNova', 'Nova senha', 'new-password', 12)}</form>`,
      footer: cancelButton + submit('Salvar nova senha', 'senhaForm'), initialFocus: '#senhaAtual'
    });
    dialog.query('form').addEventListener('submit', async event => {
      event.preventDefault();
      if (dialog.element.getAttribute('aria-busy') === 'true' || !validateForm(event.target)) return;
      dialog.setBusy(true);
      try {
        await request('/api/auth/password', { method: 'POST', data: { senhaAtual: dialog.query('#senhaAtual').value, novaSenha: dialog.query('#senhaNova').value } });
        dialog.setBusy(false);
        dialog.close();
        afterPassword();
      } catch (error) {
        dialog.setBusy(false);
        if (dialog.element.isConnected) {
          const field = error.message === 'Senha atual incorreta.' ? '#senhaAtual'
            : ['A nova senha deve ser diferente da anterior.', 'Informe a senha atual e uma nova senha de pelo menos 12 caracteres.'].includes(error.message) ? '#senhaNova' : null;
          if (field) {
            fieldError(dialog.query(field), error.message);
            dialog.query(field).focus();
          } else dialog.error(error.message);
        }
      }
    });
  }
  function openRestore(file, data) {
    const count = Object.keys(data.registros).length;
    const dialog = openDialog({ id: 'restoreModal', title: 'Restaurar backup',
      body: `<form id="restoreForm"><div class="backup-file">${icon('upload')}<div><strong>${escape(file.name)}</strong><p>Estrutura verificada · ${count} ${count === 1 ? 'jornada' : 'jornadas'} · ${data.configuracoes ? 'com configurações' : 'sem configurações'}</p></div></div><p class="notice">${icon('info')}A restauração substituirá todos os registros atuais pelos dados deste arquivo.${data.configuracoes ? ' As configurações presentes no arquivo também serão atualizadas.' : ' Suas configurações serão mantidas.'}</p><p class="field-help dialog-section">Baixe um backup atual antes de continuar. As alterações serão registradas automaticamente na auditoria. Não é necessário digitar uma justificativa.</p><label class="check-confirm" for="confirmRestore"><input type="checkbox" id="confirmRestore" required>Entendo que os registros atuais serão substituídos.</label></form>`,
      footer: cancelButton + submit('Restaurar backup', 'restoreForm'), initialFocus: '[data-close]'
    });
    const confirm = dialog.query('[data-submit]');
    confirm.disabled = true;
    dialog.query('#confirmRestore').addEventListener('change', event => { confirm.disabled = !event.target.checked; });
    dialog.query('form').addEventListener('submit', event => {
      event.preventDefault();
      void save(dialog, async () => {
        await request('/api/backup', { method: 'PUT', data });
        disableMigrationOffer();
      }, 'Backup restaurado. Alterações registradas na auditoria.');
    });
  }
  return { openDetails, openEdit, openDelete, openExtras, openAudit, openPassword, openRestore };
}
