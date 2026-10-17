// Regras puras de cálculo e validação de jornada, compartilhadas pela interface e pelos testes.
// Horários são strings HH:mm (24h); cada intervalo completo pode atravessar meia-noite.

export function horarioValido(valor) {
    return typeof valor === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(valor);
}

export function minutosDeHorario(valor) {
    if (!horarioValido(valor)) return null;
    const [hora, minuto] = valor.split(":").map(Number);
    return hora * 60 + minuto;
}

export function minutosTrabalhados(registro) {
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

export function formatarDuracao(minutos) {
    const sinal = minutos < 0 ? "-" : "";
    const absoluto = Math.abs(Math.round(minutos));
    return `${sinal}${String(Math.floor(absoluto / 60)).padStart(2, "0")}:${String(absoluto % 60).padStart(2, "0")}`;
}

export function jornadaConcluida(registro) {
    return Boolean(
        registro?.entrada && registro.saida &&
        ((!registro.saidaAlmoco && !registro.retornoAlmoco) ||
         (registro.saidaAlmoco && registro.retornoAlmoco))
    );
}

export function saldoDaJornada(registro, jornada) {
    if (!registro?.entrada) return "Não iniciada";
    if (!jornadaConcluida(registro)) return "Em andamento";
    return formatarDuracao(minutosTrabalhados(registro) - jornada);
}

export function saldoCalculado(registro, jornada) {
    return jornadaConcluida(registro) ? minutosTrabalhados(registro) - jornada : null;
}
