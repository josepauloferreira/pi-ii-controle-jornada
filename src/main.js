const STORAGE_PONTO = "meu_ponto_registros";
        const STORAGE_CONFIG = "meu_ponto_config";
        const CAMPOS_PONTO = ["entrada", "saidaAlmoco", "retornoAlmoco", "saida"];
        let registros = carregarRegistros();
        let configuracoes = carregarConfiguracoesLocais();
        let mensagemTimer = null;

        document.addEventListener("DOMContentLoaded", () => {
            carregarConfiguracoes();
            configurarMesAtual();
            atualizarRelogio();
            window.setInterval(atualizarRelogio, 1000);
            atualizarTela();
        });

        function lerJSONLocal(chave, padrao) {
            try {
                const valor = localStorage.getItem(chave);
                return valor ? JSON.parse(valor) : padrao;
            } catch (erro) {
                console.warn("Não foi possível ler os dados locais:", erro);
                return padrao;
            }
        }

        function carregarRegistros() {
            const dados = lerJSONLocal(STORAGE_PONTO, {});
            return normalizarRegistros(dados);
        }

        function carregarConfiguracoesLocais() {
            const dados = lerJSONLocal(STORAGE_CONFIG, {});
            return {
                jornada: typeof dados.jornada === "string" ? dados.jornada : "08:00",
                inicioSemana: String(dados.inicioSemana ?? "1"),
                nome: typeof dados.nome === "string" ? dados.nome : ""
            };
        }

        function normalizarRegistros(dados) {
            if (!dados || typeof dados !== "object" || Array.isArray(dados)) return {};
            const resultado = {};
            for (const [data, origem] of Object.entries(dados)) {
                if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !origem || typeof origem !== "object") continue;
                const registro = {};
                for (const campo of CAMPOS_PONTO) {
                    registro[campo] = horarioValido(origem[campo]) ? origem[campo] : null;
                }
                registro.extras = Array.isArray(origem.extras)
                    ? origem.extras.filter(item => item && horarioValido(item.horario)).map(item => ({
                        horario: item.horario,
                        descricao: typeof item.descricao === "string" ? item.descricao : "Batida extra"
                    }))
                    : [];
                resultado[data] = registro;
            }
            return resultado;
        }

        function horarioValido(valor) {
            return typeof valor === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(valor);
        }

        function dataHoje() {
            const agora = new Date();
            return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
        }

        function formatarData(data) {
            const [ano, mes, dia] = data.split("-");
            return `${dia}/${mes}/${ano}`;
        }

        function atualizarRelogio() {
            const agora = new Date();
            const relogio = document.getElementById("relogio");
            const dataAtual = document.getElementById("dataAtual");
            if (relogio) relogio.textContent = agora.toLocaleTimeString("pt-BR");
            if (dataAtual) dataAtual.textContent = agora.toLocaleDateString("pt-BR", {
                weekday: "long", day: "2-digit", month: "long", year: "numeric"
            });
        }

        function configurarMesAtual() {
            const filtro = document.getElementById("mesFiltro");
            if (filtro && !filtro.value) filtro.value = dataHoje().slice(0, 7);
        }

        function carregarConfiguracoes() {
            document.getElementById("jornadaDiaria").value = configuracoes.jornada || "08:00";
            document.getElementById("inicioSemana").value = configuracoes.inicioSemana || "1";
            document.getElementById("nomeFuncionario").value = configuracoes.nome || "";
        }

        function salvarConfiguracoes() {
            configuracoes.jornada = document.getElementById("jornadaDiaria").value || "08:00";
            configuracoes.inicioSemana = document.getElementById("inicioSemana").value || "1";
            configuracoes.nome = document.getElementById("nomeFuncionario").value.trim();
            try {
                localStorage.setItem(STORAGE_CONFIG, JSON.stringify(configuracoes));
                atualizarTela();
                mostrarMensagem("Configurações salvas!");
            } catch (erro) {
                mostrarMensagem("Não foi possível salvar neste navegador. Faça um backup dos dados.");
            }
        }

        function criarRegistroSeNecessario(data = dataHoje()) {
            if (!registros[data]) {
                registros[data] = { entrada: null, saidaAlmoco: null, retornoAlmoco: null, saida: null, extras: [] };
            }
            if (!Array.isArray(registros[data].extras)) registros[data].extras = [];
            return registros[data];
        }

        function baterPonto() {
            const data = dataHoje();
            const registro = criarRegistroSeNecessario(data);
            const horario = new Date().toTimeString().slice(0, 5);
            const proximoCampo = CAMPOS_PONTO.find(campo => !registro[campo]);
            if (proximoCampo) {
                registro[proximoCampo] = horario;
            } else {
                registro.extras.push({ horario, descricao: "Batida extra" });
            }
            salvarDados();
            atualizarTela();
            mostrarMensagem(`Ponto registrado às ${horario}`);
        }

        function salvarDados() {
            try {
                localStorage.setItem(STORAGE_PONTO, JSON.stringify(registros));
                return true;
            } catch (erro) {
                console.error("Falha ao salvar os registros locais:", erro);
                mostrarMensagem("Falha ao salvar. Exporte um backup e verifique o espaço do navegador.");
                return false;
            }
        }

        function minutosDeHorario(valor) {
            if (!horarioValido(valor)) return null;
            const [hora, minuto] = valor.split(":").map(Number);
            return hora * 60 + minuto;
        }

        function minutosTrabalhados(registro) {
            if (!registro) return 0;
            const pares = registro.saidaAlmoco
                ? [[registro.entrada, registro.saidaAlmoco], [registro.retornoAlmoco, registro.saida]]
                : [[registro.entrada, registro.saida]];
            return pares.reduce((total, [inicio, fim]) => {
                let a = minutosDeHorario(inicio);
                let b = minutosDeHorario(fim);
                if (a === null || b === null) return total;
                if (b < a) b += 24 * 60;
                return total + (b - a);
            }, 0);
        }

        function formatarDuracao(minutos) {
            const sinal = minutos < 0 ? "-" : "";
            const absoluto = Math.abs(Math.round(minutos));
            return `${sinal}${String(Math.floor(absoluto / 60)).padStart(2, "0")}:${String(absoluto % 60).padStart(2, "0")}`;
        }

        function atualizarTela() {
            const hoje = dataHoje();
            const registro = registros[hoje] || { entrada: null, saidaAlmoco: null, retornoAlmoco: null, saida: null, extras: [] };
            for (const campo of CAMPOS_PONTO) {
                const elemento = document.getElementById(campo);
                if (elemento) elemento.textContent = registro[campo] || "--:--";
                const sufixo = campo.charAt(0).toUpperCase() + campo.slice(1);
                const botaoEditar = document.getElementById(`editar${sufixo}`);
                const botaoApagar = document.getElementById(`apagar${sufixo}`);
                if (botaoEditar) botaoEditar.hidden = !registro[campo];
                if (botaoApagar) botaoApagar.hidden = !registro[campo];
            }
            renderizarExtrasHoje(registro.extras || []);
            const jornada = minutosDeHorario(configuracoes.jornada) || 480;
            const trabalhado = minutosTrabalhados(registro);
            document.getElementById("horasHoje").textContent = formatarDuracao(trabalhado);
            document.getElementById("jornadaHoje").textContent = formatarDuracao(jornada);
            const saldo = document.getElementById("saldoHoje");
            saldo.textContent = formatarDuracao(trabalhado - jornada);
            saldo.classList.toggle("saldo-positivo", trabalhado - jornada > 0);
            saldo.classList.toggle("saldo-negativo", trabalhado - jornada < 0);
            document.getElementById("quantidadeBatidas").textContent = String(CAMPOS_PONTO.filter(campo => registro[campo]).length + (registro.extras || []).length);
            renderizarHistorico();
        }

        function renderizarExtrasHoje(extras) {
            const lista = document.getElementById("extrasHoje");
            lista.replaceChildren();
            if (!extras.length) {
                const vazio = document.createElement("p");
                vazio.className = "sem-registro";
                vazio.textContent = "Nenhuma batida extra.";
                lista.appendChild(vazio);
                return;
            }
            extras.forEach((item, indice) => {
                const linha = document.createElement("div");
                linha.className = "extra-item";
                const descricao = document.createElement("span");
                descricao.textContent = `${item.horario} — ${item.descricao || "Batida extra"}`;
                const acoes = document.createElement("div");
                acoes.className = "extra-acoes";
                const editar = document.createElement("button");
                editar.type = "button";
                editar.className = "btn btn-azul";
                editar.textContent = "Editar";
                editar.addEventListener("click", () => abrirModalExtra(dataHoje(), indice));
                const excluir = document.createElement("button");
                excluir.type = "button";
                excluir.className = "btn btn-vermelho";
                excluir.textContent = "Excluir";
                excluir.addEventListener("click", () => excluirBatidaExtra(dataHoje(), indice));
                linha.appendChild(descricao);
                acoes.append(editar, excluir);
                linha.appendChild(acoes);
                lista.appendChild(linha);
            });
        }

        function renderizarHistorico() {
            const corpo = document.getElementById("tabelaHistorico");
            if (!corpo) return;
            corpo.replaceChildren();
            const mes = document.getElementById("mesFiltro").value;
            const datas = Object.keys(registros).filter(data => !mes || data.startsWith(mes)).sort((a, b) => b.localeCompare(a));
            if (!datas.length) {
                const linha = document.createElement("tr");
                const celula = document.createElement("td");
                celula.colSpan = 9;
                celula.className = "sem-registro";
                celula.textContent = "Nenhum registro neste mês.";
                linha.appendChild(celula);
                corpo.appendChild(linha);
                return;
            }
            for (const data of datas) {
                const registro = registros[data];
                const linha = document.createElement("tr");
                const extras = (registro.extras || []).map(item => `${item.horario} (${item.descricao || "Batida extra"})`).join("; ") || "—";
                const trabalhado = minutosTrabalhados(registro);
                const saldo = trabalhado - (minutosDeHorario(configuracoes.jornada) || 480);
                const valores = [formatarData(data), registro.entrada || "—", registro.saidaAlmoco || "—", registro.retornoAlmoco || "—", registro.saida || "—", extras, formatarDuracao(trabalhado), formatarDuracao(saldo)];
                valores.forEach((valor, indice) => {
                    const celula = document.createElement("td");
                    celula.textContent = valor;
                    if (indice === 7 && saldo !== 0) celula.className = saldo > 0 ? "saldo-positivo" : "saldo-negativo";
                    linha.appendChild(celula);
                });
                const acoes = document.createElement("td");
                const editar = document.createElement("button");
                editar.className = "btn btn-azul";
                editar.textContent = "Editar";
                editar.addEventListener("click", () => abrirEdicao(data));
                const excluir = document.createElement("button");
                excluir.type = "button";
                excluir.className = "btn btn-vermelho";
                excluir.textContent = "Excluir dia";
                excluir.style.marginLeft = "6px";
                excluir.addEventListener("click", () => excluirRegistro(data));
                const gerenciarExtras = document.createElement("button");
                gerenciarExtras.type = "button";
                gerenciarExtras.className = "btn btn-secundario";
                gerenciarExtras.textContent = `Extras (${(registro.extras || []).length})`;
                gerenciarExtras.style.marginLeft = "6px";
                gerenciarExtras.addEventListener("click", () => abrirModalExtra(data));
                acoes.append(editar, excluir, gerenciarExtras);
                linha.appendChild(acoes);
                corpo.appendChild(linha);
            }
        }

        function editarBatidaHoje(campo) {
            abrirEdicao(dataHoje(), campo);
        }

        function abrirEdicao(data, campoFoco = null) {
            const registro = registros[data];
            if (!registro) return;
            document.getElementById("dataEdicao").value = data;
            document.getElementById("editEntrada").value = registro.entrada || "";
            document.getElementById("editSaidaAlmoco").value = registro.saidaAlmoco || "";
            document.getElementById("editRetorno").value = registro.retornoAlmoco || "";
            document.getElementById("editSaida").value = registro.saida || "";
            document.getElementById("modalEdicao").style.display = "flex";
            if (campoFoco) {
                const ids = { entrada: "editEntrada", saidaAlmoco: "editSaidaAlmoco", retornoAlmoco: "editRetorno", saida: "editSaida" };
                setTimeout(() => document.getElementById(ids[campoFoco])?.focus(), 0);
            }
        }

        function fecharModalEdicao() {
            document.getElementById("modalEdicao").style.display = "none";
        }

        function salvarEdicao() {
            const data = document.getElementById("dataEdicao").value;
            if (!registros[data]) return;
            const anterior = { ...registros[data] };
            const campos = [["entrada", "editEntrada"], ["saidaAlmoco", "editSaidaAlmoco"], ["retornoAlmoco", "editRetorno"], ["saida", "editSaida"]];
            for (const [campo, id] of campos) {
                const valor = document.getElementById(id).value;
                if (valor && !horarioValido(valor)) {
                    mostrarMensagem("Confira os horários informados.");
                    return;
                }
                registros[data][campo] = valor || null;
            }
            removerRegistroSeVazio(data);
            if (!salvarDados()) {
                registros[data] = anterior;
                atualizarTela();
                return;
            }
            fecharModalEdicao();
            atualizarTela();
            mostrarMensagem("Registro atualizado.");
        }

        function removerRegistroSeVazio(data) {
            const registro = registros[data];
            if (!registro) return;
            const temBatidaPrincipal = CAMPOS_PONTO.some(campo => registro[campo]);
            const temExtra = Array.isArray(registro.extras) && registro.extras.length > 0;
            if (!temBatidaPrincipal && !temExtra) delete registros[data];
        }

        function excluirRegistro(data) {
            if (!window.confirm(`Excluir o registro de ${formatarData(data)}? Essa ação não pode ser desfeita.`)) return;
            const anterior = registros[data];
            delete registros[data];
            if (!salvarDados()) {
                if (anterior) registros[data] = anterior;
                atualizarTela();
                return;
            }
            atualizarTela();
            mostrarMensagem("Registro excluído.");
        }

        function excluirBatidaHoje(campo) {
            excluirBatida(dataHoje(), campo);
        }

        function excluirBatidaEmEdicao(campo) {
            const data = document.getElementById("dataEdicao").value;
            excluirBatida(data, campo);
            if (registros[data]) {
                const ids = { entrada: "editEntrada", saidaAlmoco: "editSaidaAlmoco", retornoAlmoco: "editRetorno", saida: "editSaida" };
                document.getElementById(ids[campo]).value = registros[data][campo] || "";
            } else {
                fecharModalEdicao();
            }
        }

        function excluirBatida(data, campo) {
            const registro = registros[data];
            if (!registro || !CAMPOS_PONTO.includes(campo) || !registro[campo]) return;
            const nomes = { entrada: "Entrada", saidaAlmoco: "Saída do almoço", retornoAlmoco: "Retorno do almoço", saida: "Saída" };
            if (!window.confirm(`Excluir ${nomes[campo]} (${registro[campo]}) de ${formatarData(data)}?`)) return;
            const horarioAnterior = registro[campo];
            registro[campo] = null;
            removerRegistroSeVazio(data);
            if (!salvarDados()) {
                if (!registros[data]) registros[data] = { entrada: null, saidaAlmoco: null, retornoAlmoco: null, saida: null, extras: [] };
                registros[data][campo] = horarioAnterior;
                atualizarTela();
                return;
            }
            atualizarTela();
            mostrarMensagem("Batida excluída.");
        }

        function renderizarListaExtrasModal(data) {
            const lista = document.getElementById("listaExtrasModal");
            lista.replaceChildren();
            const extras = registros[data]?.extras || [];
            if (!extras.length) {
                const vazio = document.createElement("p");
                vazio.className = "sem-registro";
                vazio.textContent = "Nenhuma batida extra neste dia.";
                lista.appendChild(vazio);
                return;
            }
            extras.forEach((item, indice) => {
                const linha = document.createElement("div");
                linha.className = "extra-item";
                const texto = document.createElement("span");
                texto.textContent = `${item.horario} — ${item.descricao || "Batida extra"}`;
                const acoes = document.createElement("div");
                acoes.className = "extra-acoes";
                const editar = document.createElement("button");
                editar.type = "button";
                editar.className = "btn btn-azul";
                editar.textContent = "Editar";
                editar.addEventListener("click", () => abrirModalExtra(data, indice));
                const excluir = document.createElement("button");
                excluir.type = "button";
                excluir.className = "btn btn-vermelho";
                excluir.textContent = "Excluir";
                excluir.addEventListener("click", () => excluirBatidaExtra(data, indice));
                linha.append(texto, acoes);
                acoes.append(editar, excluir);
                lista.appendChild(linha);
            });
        }

        function abrirModalExtra(data = dataHoje(), indice = null) {
            const registro = registros[data];
            const extra = indice === null ? null : registro?.extras?.[indice];
            document.getElementById("dataExtra").value = data;
            document.getElementById("dataModalExtra").textContent = `Data: ${formatarData(data)}`;
            document.getElementById("tituloModalExtra").textContent = "Gerenciar batidas extras";
            document.getElementById("indiceExtra").value = extra ? String(indice) : "";
            document.getElementById("horarioExtra").value = extra?.horario || new Date().toTimeString().slice(0, 5);
            document.getElementById("descricaoExtra").value = extra?.descricao || "";
            document.getElementById("textoBotaoExtra").textContent = extra ? "Salvar alterações" : "Adicionar batida";
            renderizarListaExtrasModal(data);
            document.getElementById("modalExtra").style.display = "flex";
        }

        function fecharModalExtra() {
            document.getElementById("modalExtra").style.display = "none";
        }

        function salvarBatidaExtra() {
            const data = document.getElementById("dataExtra").value || dataHoje();
            const horario = document.getElementById("horarioExtra").value;
            if (!horarioValido(horario)) {
                mostrarMensagem("Informe um horário válido.");
                return;
            }
            const descricao = document.getElementById("descricaoExtra").value.trim() || "Batida extra";
            const indiceTexto = document.getElementById("indiceExtra").value;
            const indice = indiceTexto === "" ? null : Number(indiceTexto);
            const anterior = registros[data] ? { ...registros[data], extras: [...(registros[data].extras || [])] } : null;
            if (indice !== null && !registros[data]?.extras?.[indice]) {
                mostrarMensagem("Esta batida extra não foi encontrada. Atualize o histórico e tente novamente.");
                return;
            }
            const registro = criarRegistroSeNecessario(data);
            if (indice === null) {
                registro.extras.push({ horario, descricao });
            } else {
                registro.extras[indice] = { horario, descricao };
            }
            if (!salvarDados()) {
                if (anterior) registros[data] = anterior;
                else delete registros[data];
                atualizarTela();
                return;
            }
            fecharModalExtra();
            atualizarTela();
            mostrarMensagem(indice === null ? "Batida extra adicionada." : "Batida extra atualizada.");
        }

        function excluirBatidaExtra(data, indice) {
            const registro = registros[data];
            if (!registro || !registro.extras?.[indice]) return;
            const extraAnterior = registro.extras[indice];
            if (!window.confirm(`Excluir a batida extra das ${extraAnterior.horario} em ${formatarData(data)}?`)) return;
            const copiaAnterior = { ...registro, extras: [...registro.extras] };
            registro.extras.splice(indice, 1);
            removerRegistroSeVazio(data);
            if (!salvarDados()) {
                registros[data] = copiaAnterior;
                atualizarTela();
                return;
            }
            atualizarTela();
            if (document.getElementById("modalExtra").style.display === "flex") abrirModalExtra(data);
            mostrarMensagem("Batida extra excluída.");
        }

        function baixarArquivo(nome, conteudo, tipo) {
            const arquivo = new Blob([conteudo], { type: tipo });
            const url = URL.createObjectURL(arquivo);
            const link = document.createElement("a");
            link.href = url;
            link.download = nome;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        }

        function exportarJSON() {
            const backup = { versao: 1, exportadoEm: new Date().toISOString(), configuracoes, registros };
            baixarArquivo(`backup-meu-ponto-${dataHoje()}.json`, JSON.stringify(backup, null, 2), "application/json;charset=utf-8");
            mostrarMensagem("Backup JSON baixado.");
        }

        function exportarCSV() {
            const mes = document.getElementById("mesFiltro").value;
            const linhas = [["Data", "Entrada", "Saída almoço", "Retorno almoço", "Saída", "Extras", "Horas trabalhadas", "Saldo"]];
            Object.keys(registros).filter(data => !mes || data.startsWith(mes)).sort().forEach(data => {
                const registro = registros[data];
                const trabalhado = minutosTrabalhados(registro);
                const saldo = trabalhado - (minutosDeHorario(configuracoes.jornada) || 480);
                linhas.push([formatarData(data), registro.entrada || "", registro.saidaAlmoco || "", registro.retornoAlmoco || "", registro.saida || "", (registro.extras || []).map(item => `${item.horario} ${item.descricao || "Batida extra"}`).join(" | "), formatarDuracao(trabalhado), formatarDuracao(saldo)]);
            });
            const csv = "\uFEFF" + linhas.map(linha => linha.map(valor => `"${String(valor).replace(/"/g, '""')}"`).join(";")).join("\r\n");
            baixarArquivo(`meu-ponto-${mes || dataHoje().slice(0, 7)}.csv`, csv, "text/csv;charset=utf-8");
            mostrarMensagem("Arquivo CSV baixado.");
        }

        async function importarJSON(evento) {
            const arquivo = evento.target.files && evento.target.files[0];
            if (!arquivo) return;
            try {
                const conteudo = JSON.parse(await arquivo.text());
                const registrosImportados = normalizarRegistros(conteudo.registros || conteudo);
                if (!Object.keys(registrosImportados).length) throw new Error("O arquivo não contém registros válidos.");
                if (!window.confirm("Restaurar este backup substituirá os registros atuais neste navegador. Deseja continuar?")) return;
                registros = registrosImportados;
                if (conteudo.configuracoes && typeof conteudo.configuracoes === "object") {
                    configuracoes = {
                        jornada: horarioValido(conteudo.configuracoes.jornada) ? conteudo.configuracoes.jornada : "08:00",
                        inicioSemana: String(conteudo.configuracoes.inicioSemana ?? "1"),
                        nome: typeof conteudo.configuracoes.nome === "string" ? conteudo.configuracoes.nome : ""
                    };
                    localStorage.setItem(STORAGE_CONFIG, JSON.stringify(configuracoes));
                    carregarConfiguracoes();
                }
                salvarDados();
                atualizarTela();
                mostrarMensagem("Backup restaurado.");
            } catch (erro) {
                console.error(erro);
                mostrarMensagem("Não foi possível importar. Selecione um backup JSON válido.");
            } finally {
                evento.target.value = "";
            }
        }

        function mostrarMensagem(texto) {
            const elemento = document.getElementById("mensagem");
            if (!elemento) return;
            elemento.textContent = texto;
            elemento.style.display = "block";
            if (mensagemTimer) clearTimeout(mensagemTimer);
            mensagemTimer = setTimeout(() => { elemento.style.display = "none"; }, 3000);
        }

// Os eventos HTML existentes chamam estas funções pelo objeto global.
// Como o Vite usa módulos ES, disponibilizamos os handlers em window.
Object.assign(window, {
  baterPonto,
  editarBatidaHoje,
  excluirBatidaHoje,
  abrirModalExtra,
  salvarConfiguracoes,
  renderizarHistorico,
  exportarCSV,
  exportarJSON,
  importarJSON,
  fecharModalExtra,
  salvarBatidaExtra,
  excluirBatidaEmEdicao,
  fecharModalEdicao,
  salvarEdicao,
});
