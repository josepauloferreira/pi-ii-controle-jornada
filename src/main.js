import { horarioValido, minutosDeHorario, minutosTrabalhados, formatarDuracao, jornadaConcluida, saldoDaJornada, saldoCalculado } from "./jornada.js";

const STORAGE_PONTO = "meu_ponto_registros";
        const STORAGE_CONFIG = "meu_ponto_config";
        const CAMPOS_PONTO = ["entrada", "saidaAlmoco", "retornoAlmoco", "saida"];
        let registros = {};
        let jornadasPrevistas = {};
        let dataJornadaAtiva = null;
        let configuracoes = carregarConfiguracoesLocais();
        let mensagemTimer = null;
        let pontoServidorPronto = false;
        let registrandoPonto = false;
        let usuarioLogado = null;
        let csrfToken = null;
        let cadastroInicial = false;

        document.addEventListener("DOMContentLoaded", () => {
            configurarCampos24Horas();
            configurarMesAtual();
            atualizarRelogio();
            window.setInterval(atualizarRelogio, 1000);
            document.getElementById("btnBaterPonto").disabled = true;
            document.getElementById("btnBackupLocal").addEventListener("click", exportarBackupLocal);
            document.getElementById("authForm").addEventListener("submit", enviarAutenticacao);
            document.getElementById("btnSair").addEventListener("click", sairConta);
            document.getElementById("btnTrocarSenha").addEventListener("click", () => {
                document.getElementById("senhaError").textContent = "";
                document.getElementById("senhaModal").style.display = "flex";
                document.getElementById("senhaAtual").focus();
            });
            document.getElementById("cancelarSenha").addEventListener("click", fecharTrocaSenha);
            document.getElementById("senhaForm").addEventListener("submit", enviarTrocaSenha);
            void iniciarAcesso();
        });

        function mostrarEntrada(paraCadastro) {
            cadastroInicial = paraCadastro;
            document.getElementById("appView").hidden = true;
            document.getElementById("authView").hidden = false;
            document.getElementById("authTitle").textContent = paraCadastro ? "Crie sua conta." : "Entre na sua conta.";
            document.getElementById("authDescription").textContent = paraCadastro
                ? "Configure seu acesso pessoal para registrar sua jornada."
                : "Acesse seus registros de jornada.";
            document.getElementById("authSubmit").textContent = paraCadastro ? "Criar conta" : "Entrar";
            document.getElementById("confirmarSenhaCampo").hidden = !paraCadastro;
            document.getElementById("authConfirmarSenha").required = paraCadastro;
            document.getElementById("authSenha").autocomplete = paraCadastro ? "new-password" : "current-password";
            document.getElementById("authUsuario").autocomplete = paraCadastro ? "username" : "username";
            document.getElementById("authSenha").value = "";
            document.getElementById("authConfirmarSenha").value = "";
        }

        function limparSessao() {
            usuarioLogado = null;
            csrfToken = null;
            pontoServidorPronto = false;
            registros = {};
            jornadasPrevistas = {};
            dataJornadaAtiva = null;
            configuracoes = { nome: "", jornada: "08:00", inicioSemana: "1" };
            document.getElementById("btnBaterPonto").disabled = true;
            document.getElementById("senhaModal").style.display = "none";
            document.getElementById("modalExtra").style.display = "none";
            document.getElementById("modalEdicao").style.display = "none";
            document.getElementById("usuarioAtual").textContent = "";
            document.getElementById("nomeFuncionario").value = "";
            document.getElementById("appView").hidden = true;
            // Limpa dados exibidos em uma sessão anterior no navegador compartilhado.
            atualizarTela();
        }

        async function iniciarAcesso() {
            try {
                const sessao = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
                if (sessao.ok) {
                    await entrarNaConta(await sessao.json());
                    return;
                }
                if (sessao.status !== 401) throw new Error("Não foi possível validar a sessão.");
                const status = await fetch("/api/auth/status", { cache: "no-store" });
                if (!status.ok) throw new Error("Não foi possível consultar o cadastro.");
                const dados = await status.json();
                mostrarEntrada(!!dados.cadastroDisponivel);
            } catch (erro) {
                limparSessao();
                mostrarEntrada(false);
                document.getElementById("authError").textContent =
                    "Servidor indisponível. Tente atualizar a página.";
                console.error("Erro ao acessar o servidor:", erro);
            }
        }

        async function entrarNaConta(dados) {
            usuarioLogado = dados.usuario;
            csrfToken = dados.csrfToken;
            document.getElementById("usuarioAtual").textContent = usuarioLogado;
            document.getElementById("authError").textContent = "";
            document.getElementById("authView").hidden = true;
            document.getElementById("appView").hidden = false;
            await carregarDadosIniciais();
        }

        async function enviarAutenticacao(evento) {
            evento.preventDefault();
            const erro = document.getElementById("authError");
            const botao = document.getElementById("authSubmit");
            erro.textContent = "";
            const usuario = document.getElementById("authUsuario").value.trim().toLowerCase();
            const senha = document.getElementById("authSenha").value;
            const confirmarSenha = document.getElementById("authConfirmarSenha").value;
            if (cadastroInicial && senha !== confirmarSenha) {
                erro.textContent = "As senhas não coincidem.";
                return;
            }
            botao.disabled = true;
            try {
                const resposta = await fetch(cadastroInicial ? "/api/auth/register" : "/api/auth/login", {
                    method: "POST", credentials: "same-origin", cache: "no-store",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ usuario, senha, ...(cadastroInicial ? { confirmarSenha } : {}) })
                });
                const dados = await resposta.json().catch(() => ({}));
                if (!resposta.ok) {
                    if (resposta.status === 409 && cadastroInicial) mostrarEntrada(false);
                    throw new Error(dados.erro || "Não foi possível acessar a conta.");
                }
                document.getElementById("authSenha").value = "";
                document.getElementById("authConfirmarSenha").value = "";
                await entrarNaConta(dados);
            } catch (falha) {
                erro.textContent = falha.message || "Verifique sua conexão e tente novamente.";
            } finally {
                botao.disabled = false;
            }
        }

        async function sairConta() {
            try {
                await requisitarAPI("/api/auth/logout", { method: "POST" });
                limparSessao();
                mostrarEntrada(false);
            } catch (erro) {
                mostrarMensagem(erro.message || "Não foi possível encerrar a sessão.");
            }
        }

        function fecharTrocaSenha() {
            document.getElementById("senhaModal").style.display = "none";
            document.getElementById("senhaForm").reset();
            document.getElementById("senhaError").textContent = "";
        }

        async function enviarTrocaSenha(evento) {
            evento.preventDefault();
            const botao = document.getElementById("salvarSenha");
            const erro = document.getElementById("senhaError");
            erro.textContent = "";
            botao.disabled = true;
            try {
                await requisitarAPI("/api/auth/password", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        senhaAtual: document.getElementById("senhaAtual").value,
                        novaSenha: document.getElementById("senhaNova").value
                    })
                });
                limparSessao();
                mostrarEntrada(false);
                document.getElementById("authDescription").textContent =
                    "Senha atualizada. Entre novamente com sua nova senha.";
            } catch (falha) {
                erro.textContent = falha.message || "Não foi possível trocar a senha.";
            } finally {
                botao.disabled = false;
            }
        }

        // O banco de dados é a fonte dos registros e das configurações.
        async function requisitarAPI(caminho, opcoes = {}) {
            const metodo = (opcoes.method || "GET").toUpperCase();
            const headers = { ...(opcoes.headers || {}) };
            if (metodo !== "GET" && csrfToken) headers["X-CSRF-Token"] = csrfToken;
            const resposta = await fetch(caminho, {
                ...opcoes, headers, credentials: "same-origin", cache: "no-store"
            });
            if (resposta.status === 401) {
                limparSessao();
                mostrarEntrada(false);
                throw new Error("Sessão encerrada. Entre novamente.");
            }
            if (resposta.status === 404 && (metodo === "DELETE" ||
                (metodo === "GET" && caminho.startsWith("/api/registros/")))) {
                return null;
            }
            if (!resposta.ok) {
                const corpo = await resposta.json().catch(() => ({}));
                throw new Error(corpo.erro || "Não foi possível comunicar com o servidor.");
            }
            return resposta.status === 204 ? null : resposta.json();
        }

                function requisitarRegistro(data, opcoes = {}) {
            return requisitarAPI(`/api/registros/${data}`, opcoes);
        }

        function salvarRegistroNoServidor(data, registro, justificativa) {
            return requisitarRegistro(data, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...registro, justificativa })
            });
        }

        function solicitarJustificativa() {
            const motivo = window.prompt(
                "Por que você precisa corrigir ou excluir este registro? Informe ao menos 10 caracteres."
            );
            if (motivo === null) {
                mostrarMensagem("Operação cancelada.");
                return null;
            }
            const texto = motivo.trim();
            if (texto.length < 10 || texto.length > 500) {
                mostrarMensagem("A justificativa precisa ter entre 10 e 500 caracteres.");
                return null;
            }
            return texto;
        }

        function exportarBackupLocal() {
            const antigos = carregarRegistros();
            const backup = {
                versao: 1, exportadoEm: new Date().toISOString(),
                configuracoes: carregarConfiguracoesLocais(), registros: antigos
            };
            baixarArquivo(
                `backup-local-antigo-${dataHoje()}.json`,
                JSON.stringify(backup, null, 2),
                "application/json;charset=utf-8"
            );
        }

        async function carregarDadosIniciais({ oferecerMigracao = true } = {}) {
            pontoServidorPronto = false;
            document.getElementById("btnBaterPonto").disabled = true;

            try {
                const [dadosServidor, configRemota] = await Promise.all([
                    requisitarAPI("/api/registros"),
                    requisitarAPI("/api/configuracoes")
                ]);
                if (!dadosServidor || !configRemota) throw new Error("Dados incompletos do servidor.");
                let dados = normalizarRegistros(dadosServidor);
                let configServidor = configRemota;

                const locais = carregarRegistros();
                if (Object.keys(locais).length) {
                    document.getElementById("btnBackupLocal").style.display = "inline-block";
                }

                const faltantes = Object.keys(locais).filter(data => {
                    const dataReal = new Date(`${data}T00:00:00Z`);
                    return !Object.hasOwn(dados, data)
                        && !Number.isNaN(dataReal.getTime())
                        && dataReal.toISOString().slice(0, 10) === data;
                });
                if (oferecerMigracao && faltantes.length && !localStorage.getItem("meu_ponto_backup_restaurado")) {
                    if (window.confirm(
                        `Foram encontrados ${faltantes.length} dia(s) no navegador que não estão no banco de dados. ` +
                        "Deseja copiá-los para o banco? Dias já existentes no banco não serão substituídos. " +
                        "Se preferir, cancele e baixe o backup local antigo."
                    )) {
                        let falhas = 0;
                        for (const data of faltantes) {
                            try {
                                // Não sobrescreve dias que possam ter sido criados no servidor.
                                const atual = await requisitarRegistro(data);
                                if (!atual) await salvarRegistroNoServidor(data, locais[data], "Importação de registros anteriores do navegador");
                            } catch (erroMigracao) {
                                console.warn("Não foi possível migrar um dia local:", data, erroMigracao);
                                falhas++;
                            }
                        }
                        dados = normalizarRegistros(await requisitarAPI("/api/registros"));
                        if (falhas) mostrarMensagem(`${falhas} dia(s) não foram migrados. Preserve o backup local e tente novamente.`);
                    }
                }
                // Só oferece copiar configurações antigas quando o servidor ainda usa padrões iniciais.
                const configLocal = carregarConfiguracoesLocais();
                const configPadrao = { nome: "", jornada: "08:00", inicioSemana: "1" };
                const migrarConfig = oferecerMigracao
                    && !localStorage.getItem("meu_ponto_backup_restaurado")
                    && localStorage.getItem(STORAGE_CONFIG)
                    && horarioValido(configLocal.jornada)
                    && (configLocal.inicioSemana === "0" || configLocal.inicioSemana === "1")
                    && Object.entries(configPadrao).every(([campo, valor]) => configServidor[campo] === valor)
                    && Object.entries(configPadrao).some(([campo, valor]) => configLocal[campo] !== valor);
                if (migrarConfig && window.confirm(
                    "Há configurações antigas neste navegador e o banco de dados ainda usa as configurações padrão. " +
                    "Deseja copiá-las para o banco? Se cancelar, a cópia local será preservada."
                )) {
                    configServidor = await requisitarAPI("/api/configuracoes", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(configLocal)
                    });
                }
                const conflitantes = Object.keys(locais).filter(data =>
                    Object.hasOwn(dados, data) && JSON.stringify(dados[data]) !== JSON.stringify(locais[data])
                );

                registros = dados;
                jornadasPrevistas = await requisitarAPI("/api/jornada/previstas");
                dataJornadaAtiva = (await requisitarAPI("/api/jornada/ativa")).data;
                configuracoes = configServidor;
                pontoServidorPronto = true;
                carregarConfiguracoes();
                atualizarTela();
                if (conflitantes.length) {
                    mostrarMensagem(`Há ${conflitantes.length} dia(s) antigos divergentes no navegador. Baixe o backup local antes de substituí-los.`);
                }
            } catch (erro) {
                console.error("Falha ao carregar dados do banco de dados:", erro);
                mostrarMensagem("Não foi possível carregar os dados do servidor. Confira sua conexão e tente novamente.");
            } finally {
                document.getElementById("btnBaterPonto").disabled = !pontoServidorPronto || jornadaConcluida(registros[dataJornadaAtiva || dataHoje()] || null);
            }
        }

        

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

        // O seletor nativo de hora pode mostrar AM/PM conforme o navegador.
        // Os campos de texto mantêm a entrada em HH:mm de 24 horas em qualquer idioma.
        function configurarCampos24Horas() {
            document.querySelectorAll('[data-formato-horario="24h"]').forEach(campo => {
                campo.addEventListener("input", () => {
                    // Permite usar teclado numérico: 0830 passa a 08:30.
                    if (/^\d{4}$/.test(campo.value)) {
                        campo.value = `${campo.value.slice(0, 2)}:${campo.value.slice(2)}`;
                    }
                });
            });
        }



        function dataHoje() {
            const partes = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
                timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit",
                day: "2-digit"
            }).formatToParts(new Date()).map(({ type, value }) => [type, value]));
            return `${partes.year}-${partes.month}-${partes.day}`;
        }

        function formatarData(data) {
            const [ano, mes, dia] = data.split("-");
            return `${dia}/${mes}/${ano}`;
        }

        function atualizarRelogio() {
            const agora = new Date();
            const relogio = document.getElementById("relogio");
            const dataAtual = document.getElementById("dataAtual");
            if (relogio) relogio.textContent = agora.toLocaleTimeString("pt-BR", { hour12: false });
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

        async function salvarConfiguracoes() {
            if (!pontoServidorPronto) {
                mostrarMensagem("Aguarde a conexão com o banco de dados.");
                return;
            }
            const novas = {
                jornada: document.getElementById("jornadaDiaria").value || "08:00",
                inicioSemana: document.getElementById("inicioSemana").value || "1",
                nome: document.getElementById("nomeFuncionario").value.trim()
            };
            try {
                configuracoes = await requisitarAPI("/api/configuracoes", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(novas)
                });
                atualizarTela();
                mostrarMensagem("Configurações salvas no banco de dados!");
            } catch (erro) {
                console.error("Falha ao salvar configurações:", erro);
                carregarConfiguracoes();
                mostrarMensagem("Erro ao salvar as configurações no banco de dados.");
            }
        }

        

        function criarRegistroSeNecessario(data = dataHoje()) {
            if (!registros[data]) {
                registros[data] = { entrada: null, saidaAlmoco: null, retornoAlmoco: null, saida: null, extras: [] };
            }
            if (!Array.isArray(registros[data].extras)) registros[data].extras = [];
            return registros[data];
        }

async function baterPonto() {
            if (!pontoServidorPronto || registrandoPonto) {
                mostrarMensagem("Aguarde a conexão com o servidor para bater ponto.");
                return;
            }
            registrandoPonto = true;
            document.getElementById("btnBaterPonto").disabled = true;
            try {
                // Nao aceita horario nem proximo campo vindos do navegador.
                const resposta = await requisitarAPI("/api/jornada/marcar", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: "{}"
                });
                registros[resposta.data] = resposta.registro;
                dataJornadaAtiva = resposta.data;
                jornadasPrevistas[resposta.data] = resposta.jornadaPrevista;
                atualizarTela();
                mostrarMensagem(`Ponto registrado pelo servidor às ${resposta.horario}.`);
            } catch (erro) {
                console.error("Não foi possível registrar o ponto:", erro);
                mostrarMensagem(erro.message || "Falha ao registrar ponto. Tente novamente.");
            } finally {
                registrandoPonto = false;
                document.getElementById("btnBaterPonto").disabled = !pontoServidorPronto || jornadaConcluida(registros[dataJornadaAtiva || dataHoje()] || null);
            }
        }

        async function salvarDados(data) {
            if (!pontoServidorPronto || !data) {
                mostrarMensagem("Aguarde o carregamento do servidor.");
                return false;
            }
            const justificativa = solicitarJustificativa();
            if (!justificativa) return false;
            try {
                if (registros[data]) {
                    registros[data] = await salvarRegistroNoServidor(data, registros[data], justificativa);
                } else {
                    await requisitarRegistro(data, {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ justificativa })
                    });
                }
                jornadasPrevistas = await requisitarAPI("/api/jornada/previstas");
                dataJornadaAtiva = (await requisitarAPI("/api/jornada/ativa")).data;
                return true;
            } catch (erro) {
                console.error("Falha ao salvar registros no banco de dados:", erro);
                mostrarMensagem("Erro ao salvar no banco de dados. Verifique a conexão.");
                return false;
            }
        }

        







        // Não calculamos saldo definitivo enquanto a jornada estiver incompleta.






        function atualizarTela() {
            const hoje = dataJornadaAtiva || dataHoje();
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
            const jornada = jornadaPrevistaDoDia(hoje);
            const trabalhado = minutosTrabalhados(registro);
            document.getElementById("horasHoje").textContent = formatarDuracao(trabalhado);
            document.getElementById("jornadaHoje").textContent = formatarDuracao(jornada);
            const botaoPonto = document.getElementById("btnBaterPonto");
            const encerrada = jornadaConcluida(registro);
            botaoPonto.disabled = !pontoServidorPronto || registrandoPonto || encerrada;
            botaoPonto.textContent = encerrada ? "Jornada concluída" : "Registrar ponto";
            const saldo = document.getElementById("saldoHoje");
            const diferenca = saldoCalculado(registro, jornada);
            saldo.textContent = saldoDaJornada(registro, jornada);
            saldo.classList.toggle("saldo-positivo", diferenca !== null && diferenca > 0);
            saldo.classList.toggle("saldo-negativo", diferenca !== null && diferenca < 0);
            document.getElementById("quantidadeBatidas").textContent = String(CAMPOS_PONTO.filter(campo => registro[campo]).length + (registro.extras || []).length);
            renderizarHistorico();
        }

        function renderizarExtrasHoje(extras) {
            const lista = document.getElementById("extrasHoje");
            lista.replaceChildren();

            if (!extras.length) {
                const vazio = document.createElement("p");
                vazio.className = "sem-registro";
                vazio.textContent = "Nenhuma batida extra registrada.";
                lista.appendChild(vazio);
                return;
            }

            const resumo = document.createElement("div");
            resumo.className = "extras-resumo";
            const texto = document.createElement("span");
            texto.textContent = `${extras.length} ${extras.length === 1 ? "batida extra registrada" : "batidas extras registradas"}`;
            const detalhes = document.createElement("button");
            detalhes.type = "button";
            detalhes.className = "btn btn-secundario";
            detalhes.textContent = "Ver detalhes";
            detalhes.addEventListener("click", () => abrirModalExtra(dataJornadaAtiva || dataHoje()));
            resumo.append(texto, detalhes);
            lista.appendChild(resumo);
        }

        function jornadaPrevistaDoDia(data) {
            const valor = jornadasPrevistas[data]?.minutos;
            return Number.isInteger(valor) ? valor : (minutosDeHorario(configuracoes.jornada) ?? 480);
        }

        function renderizarHistorico() {
            const corpo = document.getElementById("tabelaHistorico");
            if (!corpo) return;
            corpo.replaceChildren();

            const mes = document.getElementById("mesFiltro").value;
            const datas = Object.keys(registros)
                .filter(data => !mes || data.startsWith(mes))
                .sort((a, b) => b.localeCompare(a));

            if (!datas.length) {
                const linha = document.createElement("tr");
                const celula = document.createElement("td");
                celula.colSpan = 9;
                celula.className = "tabela-vazio";
                celula.textContent = "Nenhum registro neste mês.";
                linha.appendChild(celula);
                corpo.appendChild(linha);
                return;
            }

            const colunas = ["Data", "Entrada", "Saída almoço", "Retorno", "Saída", "Extras", "Trabalhadas", "Saldo"];
            for (const data of datas) {
                const registro = registros[data];
                const linha = document.createElement("tr");
                const trabalhado = minutosTrabalhados(registro);
                const jornada = jornadaPrevistaDoDia(data);
                const saldo = saldoCalculado(registro, jornada);
                const valores = [
                    formatarData(data), registro.entrada || "—", registro.saidaAlmoco || "—",
                    registro.retornoAlmoco || "—", registro.saida || "—", null,
                    formatarDuracao(trabalhado), saldoDaJornada(registro, jornada)
                ];

                valores.forEach((valor, indice) => {
                    const celula = document.createElement("td");
                    celula.dataset.label = colunas[indice];

                    if (indice === 5) {
                        const quantidade = (registro.extras || []).length;
                        const botao = document.createElement("button");
                        botao.type = "button";
                        botao.className = "extras-count";
                        botao.textContent = `${quantidade} ${quantidade === 1 ? "extra" : "extras"}`;
                        botao.setAttribute("aria-label", `Gerenciar batidas extras de ${formatarData(data)} (${quantidade})`);
                        botao.addEventListener("click", () => abrirModalExtra(data));
                        celula.appendChild(botao);
                    } else {
                        celula.textContent = valor;
                    }

                    if (indice === 7 && jornadasPrevistas[data]?.origem === "legado_estimado") {
                        celula.title = "Estimativa congelada na migração. A jornada prevista originalmente não é conhecida.";
                        celula.textContent += " (estimado)";
                    }
                    if (indice === 7 && saldo !== null && saldo !== 0) {
                        celula.classList.add(saldo > 0 ? "saldo-positivo" : "saldo-negativo");
                    }
                    linha.appendChild(celula);
                });

                const acoes = document.createElement("td");
                acoes.dataset.label = "Ações";
                const grupo = document.createElement("div");
                grupo.className = "table-actions";
                const editar = document.createElement("button");
                editar.type = "button";
                editar.className = "btn btn-secundario";
                editar.textContent = "Editar";
                editar.setAttribute("aria-label", `Editar registro de ${formatarData(data)}`);
                editar.addEventListener("click", () => abrirEdicao(data));
                const excluir = document.createElement("button");
                excluir.type = "button";
                excluir.className = "btn btn-vermelho";
                excluir.textContent = "Excluir";
                excluir.setAttribute("aria-label", `Excluir registro de ${formatarData(data)}`);
                excluir.addEventListener("click", () => excluirRegistro(data));
                grupo.append(editar, excluir);
                acoes.appendChild(grupo);
                linha.appendChild(acoes);
                corpo.appendChild(linha);
            }
        }

        function editarBatidaHoje(campo) {
            abrirEdicao(dataJornadaAtiva || dataHoje(), campo);
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

        async function salvarEdicao() {
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
            if (!(await salvarDados(data))) {
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

        async function excluirRegistro(data) {
            if (!window.confirm(`Excluir o registro de ${formatarData(data)}? Essa ação não pode ser desfeita.`)) return;
            const anterior = registros[data];
            delete registros[data];
            if (!(await salvarDados(data))) {
                if (anterior) registros[data] = anterior;
                atualizarTela();
                return;
            }
            atualizarTela();
            mostrarMensagem("Registro excluído.");
        }

        function excluirBatidaHoje(campo) {
            excluirBatida(dataJornadaAtiva || dataHoje(), campo);
        }

        async function excluirBatidaEmEdicao(campo) {
            const data = document.getElementById("dataEdicao").value;
            if (!(await excluirBatida(data, campo))) return;
            if (registros[data]) {
                const ids = { entrada: "editEntrada", saidaAlmoco: "editSaidaAlmoco", retornoAlmoco: "editRetorno", saida: "editSaida" };
                document.getElementById(ids[campo]).value = registros[data][campo] || "";
            } else {
                fecharModalEdicao();
            }
        }

        async function excluirBatida(data, campo) {
            const registro = registros[data];
            if (!registro || !CAMPOS_PONTO.includes(campo) || !registro[campo]) return;
            const nomes = { entrada: "Entrada", saidaAlmoco: "Saída do almoço", retornoAlmoco: "Retorno do almoço", saida: "Saída" };
            if (!window.confirm(`Excluir ${nomes[campo]} (${registro[campo]}) de ${formatarData(data)}?`)) return;
            const horarioAnterior = registro[campo];
            registro[campo] = null;
            removerRegistroSeVazio(data);
            if (!(await salvarDados(data))) {
                if (!registros[data]) registros[data] = { entrada: null, saidaAlmoco: null, retornoAlmoco: null, saida: null, extras: [] };
                registros[data][campo] = horarioAnterior;
                atualizarTela();
                return;
            }
            atualizarTela();
            mostrarMensagem("Batida excluída.");
            return true;
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

        function abrirModalExtra(data = dataJornadaAtiva || dataHoje(), indice = null) {
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

        async function salvarBatidaExtra() {
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
            if (!(await salvarDados(data))) {
                if (anterior) registros[data] = anterior;
                else delete registros[data];
                atualizarTela();
                return;
            }
            fecharModalExtra();
            atualizarTela();
            mostrarMensagem(indice === null ? "Batida extra adicionada." : "Batida extra atualizada.");
        }

        async function excluirBatidaExtra(data, indice) {
            const registro = registros[data];
            if (!registro || !registro.extras?.[indice]) return;
            const extraAnterior = registro.extras[indice];
            if (!window.confirm(`Excluir a batida extra das ${extraAnterior.horario} em ${formatarData(data)}?`)) return;
            const copiaAnterior = { ...registro, extras: [...registro.extras] };
            registro.extras.splice(indice, 1);
            removerRegistroSeVazio(data);
            if (!(await salvarDados(data))) {
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
            if (!pontoServidorPronto) return mostrarMensagem("Aguarde a conexão com o banco de dados para fazer backup.");
            const backup = { versao: 2, exportadoEm: new Date().toISOString(), configuracoes, registros, jornadasPrevistas };
            baixarArquivo(`backup-meu-ponto-${dataHoje()}.json`, JSON.stringify(backup, null, 2), "application/json;charset=utf-8");
            mostrarMensagem("Backup JSON baixado.");
        }

        function exportarCSV() {
            if (!pontoServidorPronto) return mostrarMensagem("Aguarde a conexão com o banco de dados para exportar CSV.");
            const mes = document.getElementById("mesFiltro").value;
            const linhas = [["Data", "Entrada", "Saída almoço", "Retorno almoço", "Saída", "Extras", "Horas trabalhadas", "Saldo", "Jornada prevista", "Origem do plano"]];
            Object.keys(registros).filter(data => !mes || data.startsWith(mes)).sort().forEach(data => {
                const registro = registros[data];
                const trabalhado = minutosTrabalhados(registro);
                const jornada = jornadaPrevistaDoDia(data);
                linhas.push([formatarData(data), registro.entrada || "", registro.saidaAlmoco || "", registro.retornoAlmoco || "", registro.saida || "", (registro.extras || []).map(item => `${item.horario} ${item.descricao || "Batida extra"}`).join(" | "), formatarDuracao(trabalhado), saldoDaJornada(registro, jornada), formatarDuracao(jornada), jornadasPrevistas[data]?.origem || "sem_snapshot"]);
            });
            const csv = "\uFEFF" + linhas.map(linha => linha.map(valor => `"${String(valor).replace(/"/g, '""')}"`).join(";")).join("\r\n");
            baixarArquivo(`meu-ponto-${mes || dataHoje().slice(0, 7)}.csv`, csv, "text/csv;charset=utf-8");
            mostrarMensagem("Arquivo CSV baixado.");
        }

        async function importarJSON(evento) {
            const arquivo = evento.target.files && evento.target.files[0];
            if (!arquivo) return;
            try {
                if (!pontoServidorPronto) throw new Error("Servidor indisponível.");
                const conteudo = JSON.parse(await arquivo.text());
                if (!conteudo || typeof conteudo !== "object" || !conteudo.registros ||
                    typeof conteudo.registros !== "object" || Array.isArray(conteudo.registros)) {
                    throw new Error("Backup precisa conter a propriedade registros.");
                }
                if (!window.confirm(
                    "Restaurar este backup substituirá TODOS os registros do banco de dados" +
                    " e as configurações presentes no arquivo. Baixe primeiro um backup atual. Continuar?"
                )) return;

                const justificativa = solicitarJustificativa();
                if (!justificativa) return;
                await requisitarAPI("/api/backup", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        justificativa,
                        registros: conteudo.registros,
                        ...(conteudo.jornadasPrevistas ? { jornadasPrevistas: conteudo.jornadasPrevistas } : {}),
                        ...(conteudo.configuracoes ? { configuracoes: conteudo.configuracoes } : {})
                    })
                });
                // Não oferecer migração local logo após substituir o banco intencionalmente.
                try {
                    localStorage.setItem("meu_ponto_backup_restaurado", "1");
                } catch (erroLocal) {
                    console.warn("Não foi possível registrar a preferência de migração local:", erroLocal);
                }
                await carregarDadosIniciais({ oferecerMigracao: false });
                if (!pontoServidorPronto) throw new Error("Restauração concluída no banco de dados, mas não foi possível recarregar a interface.");
                mostrarMensagem("Backup restaurado no banco de dados.");
            } catch (erro) {
                console.error("Falha ao restaurar o backup:", erro);
                mostrarMensagem("Não foi possível restaurar o backup. Confira o arquivo e o servidor.");
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
