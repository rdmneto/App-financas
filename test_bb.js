function parsePDFText(text) {
    const transactions = [];
    const lines = text.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(l => l.length > 5);

    // Banco do Brasil Pattern (from user log)
    // 05/01/2026  500,00 (+) 14397  52204152217051 
    // 06/01/2026  1.160,00 (-) 13105  10601 
    const patternBBPending = /^(\d{2}\/\d{2}\/\d{4})\s+([\d{1,3}(?:\.\d{3})*,\d{2}]+)\s*\(([-+])\)/;
    const patternFull = /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([-+]?\s*\d{1,3}(?:\.\d{3})*,\d{2})\s*$/;

    let pendingBBTransaction = null;

    for (const line of lines) {
        if (/^(?:saldo anterior|saldo final|saldo atual|extrato|resumo|cliente|cpf\s?:|cnpj\s?:|período|data\s+hist|saldo do dia)/i.test(line)) continue;
        if (line.includes("Saldo do dia") || line.includes("Saldo Anterior") || line.includes("S A L D O")) {
            if (pendingBBTransaction) transactions.push(pendingBBTransaction);
            pendingBBTransaction = null;
            continue;
        }

        const patternSicredi = /^(?!.*(?:Custo Efetivo|CET|Saldo))(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([-]?\d{1,3}(?:\.\d{3})*,\d{2})(?:\s+(\d{1,3}(?:\.\d{3})*,\d{2}))?$/i;
        if (line.match(patternSicredi)) continue;

        let match = line.match(patternBBPending);
        if (match) {
            if (pendingBBTransaction) transactions.push(pendingBBTransaction);

            const [, dateStr, valStr, sign] = match;
            const [day, month, year] = dateStr.split('/').map(Number);
            const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
            const value = parseFloat(valStr.replace(/\./g, '').replace(',', '.'));

            if (!isNaN(date.getTime()) && !isNaN(value) && value > 0) {
                pendingBBTransaction = { date, description: '', value, type: sign === '-' ? 'expense' : 'income' };
            }
            continue;
        }

        if (pendingBBTransaction) {
            if (line.match(patternFull)) {
                transactions.push(pendingBBTransaction);
                pendingBBTransaction = null;
            } else {
                if (!line.match(/^\d+$/) && !line.includes("BB Rende Fácil") && !line.includes("Rende Facil") && !line.includes("Pix - Recebido") && !line.includes("Pix - Enviado")) {
                    pendingBBTransaction.description += (pendingBBTransaction.description ? ' ' : '') + line.trim();
                }
                continue;
            }
        }

        match = line.match(patternFull);
        if (match) {
            const [, dateStr, desc, valStr] = match;
            const [day, month, year] = dateStr.split('/').map(Number);
            const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
            const cleanVal = valStr.replace(/\s/g, '').replace(',', '.');
            const isNegative = cleanVal.startsWith('-');
            const value = parseFloat(cleanVal.replace(/[^0-9.]/g, ''));

            if (!isNaN(date.getTime()) && !isNaN(value) && value > 0) {
                transactions.push({ date, description: desc.trim(), value, type: isNegative ? 'expense' : 'income' });
            }
        }
    }

    if (pendingBBTransaction) transactions.push(pendingBBTransaction);
    return transactions.map(t => { if (t.description === '') t.description = 'Transação'; return t; });
}

const input = `
30/12/2025 0,00 (+) Saldo Anterior
05/01/2026  500,00 (+) 14397  52204152217051 
Pix - Recebido 
05/01 22:04 28914589315 NEYLIANE SALES 
05/01/2026  500,00 (-) 9903  
BB Rende Fácil 
Rende Facil 
0,00 (+) Saldo do dia 
06/01/2026  1.160,00 (-) 13105  10601 
Pix - Enviado 
06/01 13:46 georgia natasha jones sev 
`;
console.log(JSON.stringify(parsePDFText(input), null, 2));
