export interface Transaction {
    date: Date;
    description: string;
    value: number;
    type: 'income' | 'expense';
}

export function parsePDFText(text: string): Transaction[] {
    const transactions: Transaction[] = [];

    // 1. Robust Bank Detection (Scoring System)
    const fullTextUpper = text.toUpperCase();
    const fullTextClean = fullTextUpper.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '');

    let scoreSantander = 0;
    if (fullTextClean.includes("SANTANDER")) scoreSantander += 10;
    if (fullTextClean.includes("EXTRATOCONSOLIDADO")) scoreSantander += 8;
    if (fullTextClean.includes("MOVIMENTACAO(R$)")) scoreSantander += 5;
    if (fullTextClean.includes("SALDO(R$)")) scoreSantander += 5;
    if (fullTextClean.includes("SELECTSELECT")) scoreSantander += 3;
    if (fullTextClean.includes("SELECTPLUS")) scoreSantander += 3;

    let scoreBB = 0;
    if (fullTextClean.includes("BANCODOBRASIL")) scoreBB += 10;
    if (fullTextClean.includes("RENDEFACIL")) scoreBB += 5;
    if (fullTextClean.includes("SALDODODIA")) scoreBB += 3;

    let scoreSicredi = 0;
    if (fullTextClean.includes("SICREDI")) scoreSicredi += 10;
    if (fullTextClean.includes("RESUMODOCONTROLERECURSOS")) scoreSicredi += 5;

    let bankMode: 'SANTANDER' | 'BB' | 'SICREDI' | 'NONE' = 'NONE';
    if (scoreSantander > scoreBB && scoreSantander > scoreSicredi && scoreSantander > 5) bankMode = 'SANTANDER';
    else if (scoreBB > scoreSantander && scoreBB > scoreSicredi && scoreBB > 5) bankMode = 'BB';
    else if (scoreSicredi > scoreSantander && scoreSicredi > scoreBB && scoreSicredi > 5) bankMode = 'SICREDI';

    // Normalize: collapse multiple spaces and filter very short lines
    const rawLines = text.split('\n');
    const lines: string[] = [];
    for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i].replace(/\s+/g, ' ').trim();
        if (line.length > 5) {
            lines.push(line);
        }
    }

    // Pattern definitions
    const patternBBPending = /^(\d{2}\/\d{2}\/\d{4})\s+([\d{1,3}(?:\.\d{3})*,\d{2}]+)\s*\(([-+])\)/;
    const patternFull = /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([-+]?\s*\d{1,3}(?:\.\d{3})*,\d{2})\s*$/;
    const patternShort = /(\d{2}\s+[A-Za-z]{3})\s+(.+?)\s+R?\$?\s*([\d.,]+)\s*$/i;
    const patternSicredi = /^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([-]?\d{1,3}(?:\.\d{3})*,\d{2})(?:\s+(\d{1,3}(?:\.\d.3})*,\d{2}))?$/i;
    const patternSantander = /^(\d{2}\/\d{2})\s+(.+?)\s+.*?([-+]?\d{1,3}(?:\.\d{3})*,\d{2}[-+]?)(?:\s+[\d.,]+\s*)?$/;
    const patternSantanderYear = /Resumo\s+-\s+\w?\s*[\w\s-]*\/?(\d{4})/i;

    const monthMap: Record<string, number> = {
        jan: 0, fev: 1, feb: 1, mar: 2, abr: 3, apr: 3, mai: 4, may: 4,
        jun: 5, jul: 6, ago: 7, aug: 7, set: 8, sep: 8, out: 9, oct: 9,
        nov: 10, dez: 11, dec: 11
    };
    const currentYear = new Date().getFullYear();
    let detectedYear = currentYear;
    let inSantanderMovimentacao = false;
    let santanderContext: 'CC' | 'OTHER' | 'NONE' = 'NONE';

    let pendingBBTransaction: Transaction | null = null;
    const flushPending = () => {
        if (pendingBBTransaction) {
            transactions.push(pendingBBTransaction);
            pendingBBTransaction = null;
        }
    };

    const blacklist = ["IBOVESPA", "DOLAR COMERCIAL", "EURO", "SALARIO MINIMO", "IPCA", "IGPM", "INPC", "INCC", "CDI", "SELIC", "REFERENCIA", "VALORES PRATICADOS"];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineUpper = line.toUpperCase();
        const cleanLine = lineUpper.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ''); // Improved cleanLine

        // Global Blacklist check
        if (blacklist.some(keyword => cleanLine.includes(keyword))) {
            flushPending();
            continue;
        }

        // Section Detection
        if (bankMode === 'SANTANDER') {
            const yearMatch = line.match(patternSantanderYear);
            if (yearMatch) {
                detectedYear = parseInt(yearMatch[1]);
                flushPending();
                continue;
            }

            if (cleanLine.includes("CONTACORRENTE") && lineUpper.length < 30) {
                santanderContext = 'CC';
                flushPending();
            } else if (cleanLine.includes("POUPANCA") ||
                cleanLine.includes("INVESTIMENTOS") ||
                cleanLine.includes("INDICES") ||
                cleanLine.includes("FALECONOSCO") ||
                cleanLine.includes("PACOTEDESERVICOS") ||
                cleanLine.includes("VALORESPRATICADOS") ||
                cleanLine.includes("QUANTIDADECONTRATADA")) {
                santanderContext = 'OTHER';
                inSantanderMovimentacao = false;
                flushPending();
            }

            if (cleanLine.includes("MOVIMENTACAO")) {
                if (santanderContext === 'CC') {
                    inSantanderMovimentacao = true;
                } else {
                    inSantanderMovimentacao = false;
                }
                flushPending();
                continue;
            }

            // In Santander mode, strictly skip everything if not in Movimentação
            if (!inSantanderMovimentacao) {
                flushPending(); // Ensure pending is flushed even if skipping
                continue;
            }
        }

        // Skip common headers
        if (/^(?:saldo anterior|saldo final|saldo atual|extrato|resumo|cliente|cpf\s?:|cnpj\s?:|período|data\s+hist|saldo do dia|movimentação|referência|identificação|comprovante)/i.test(line)) {
            flushPending();
            continue;
        }
        if (line.indexOf("Saldo do dia") !== -1 || line.indexOf("Saldo Anterior") !== -1 || line.indexOf("S A L D O") !== -1 || line.indexOf("Total Devido") !== -1 || line.indexOf("Informações") !== -1 || line.indexOf("SALDO EM") !== -1) {
            flushPending();
            continue;
        }

        // 2. Transaction Parsing
        // Santander Check
        if (bankMode === 'SANTANDER' || bankMode === 'NONE') { // Allow Santander pattern if bankMode is NONE as a fallback
            const santanderMatch = line.match(patternSantander);
            if (santanderMatch) {
                flushPending();
                const dateParts = santanderMatch[1].split('/');
                const day = parseInt(dateParts[0]);
                const month = parseInt(dateParts[1]) - 1;
                const date = new Date(Date.UTC(detectedYear, month, day, 12, 0, 0));

                let valStr = santanderMatch[3].replace(/\./g, '').replace(',', '.').trim();
                let isNegative = false;
                if (valStr.endsWith('-')) {
                    isNegative = true;
                    valStr = valStr.substring(0, valStr.length - 1);
                } else if (valStr.startsWith('-')) {
                    isNegative = true;
                    valStr = valStr.substring(1);
                }
                const value = parseFloat(valStr);

                if (!isNaN(date.getTime()) && !isNaN(value) && value !== 0) {
                    pendingBBTransaction = {
                        date,
                        description: santanderMatch[2].trim(),
                        value: value,
                        type: isNegative ? 'expense' : 'income'
                    };
                }
                continue;
            }
        }

        // Only try other bank patterns if not in Santander mode
        if (bankMode !== 'SANTANDER') {
            // Sicredi Check
            const sicrediMatch = line.match(patternSicredi);
            if (sicrediMatch) {
                flushPending();
                if (line.indexOf("Custo Efetivo") === -1 && line.indexOf("CET") === -1 && line.indexOf("Saldo") === -1) {
                    const dateParts = sicrediMatch[1].split('/');
                    const date = new Date(Date.UTC(Number(dateParts[2]), Number(dateParts[1]) - 1, Number(dateParts[0]), 12, 0, 0));
                    const cleanVal = sicrediMatch[3].replace(/\./g, '').replace(',', '.');
                    const isNegative = cleanVal.indexOf('-') === 0;
                    const value = Math.abs(parseFloat(cleanVal));

                    if (!isNaN(date.getTime()) && !isNaN(value) && value !== 0) {
                        transactions.push({
                            date: date,
                            description: sicrediMatch[2].trim(),
                            value: value,
                            type: isNegative ? 'expense' : 'income'
                        });
                    }
                    continue;
                }
            }

            // BB Pending check
            let match = line.match(patternBBPending);
            if (match) {
                flushPending();
                const dateParts = match[1].split('/');
                const date = new Date(Date.UTC(Number(dateParts[2]), Number(dateParts[1]) - 1, Number(dateParts[0]), 12, 0, 0));
                const value = parseFloat(match[2].replace(/\./g, '').replace(',', '.'));

                if (!isNaN(date.getTime()) && !isNaN(value) && value > 0) {
                    pendingBBTransaction = {
                        date: date,
                        description: '',
                        value: value,
                        type: match[3] === '-' ? 'expense' : 'income'
                    };
                }
                continue;
            }
        }

        // Description appending
        if (pendingBBTransaction) {
            const isPatternMatch = line.match(patternFull) || line.match(patternShort) || line.match(patternSicredi) || line.match(patternSantander);
            if (isPatternMatch) {
                flushPending();
            } else {
                if (!line.match(/^\d+$/) && !line.includes("RENDE") && !line.includes("Pix - Recebido") && !line.includes("Pix - Enviado") && !line.includes("Transferência") && !line.includes("SALDO EM") && !line.includes("REMUNERACAO") && !line.includes("APLICACAO") && !line.includes("REFERENCIA") && !line.includes("SANTANDER") && !line.includes("###")) {
                    pendingBBTransaction.description += (pendingBBTransaction.description ? ' ' : '') + line.trim();
                }
                continue;
            }
        }

        // Generic patterns (Only if bankMode is NONE or BB)
        if (bankMode === 'NONE' || bankMode === 'BB') {
            let match = line.match(patternFull);
            if (match) {
                const dateParts = match[1].split('/');
                const date = new Date(Date.UTC(Number(dateParts[2]), Number(dateParts[1]) - 1, Number(dateParts[0]), 12, 0, 0));
                const cleanVal = match[3].replace(/\s/g, '').replace(',', '.');
                const isNegative = cleanVal.indexOf('-') === 0;
                const value = parseFloat(cleanVal.replace(/[^0-9.]/g, ''));

                if (!isNaN(date.getTime()) && !isNaN(value) && value > 0) {
                    transactions.push({
                        date: date,
                        description: match[2].trim(),
                        value: value,
                        type: isNegative ? 'expense' : 'income'
                    });
                }
                continue;
            }

            match = line.match(patternShort);
            if (match) {
                const parts = match[1].trim().split(/\s+/);
                const monthKey = parts[1] ? parts[1].toLowerCase().substring(0, 3) : '';
                const monthValue = monthMap[monthKey];

                if (monthValue !== undefined) {
                    const date = new Date(Date.UTC(currentYear, monthValue, parseInt(parts[0]), 12, 0, 0));
                    if (date > new Date()) date.setUTCFullYear(currentYear - 1);
                    const value = parseFloat(match[3].replace('.', '').replace(',', '.'));
                    if (!isNaN(value) && value > 0) {
                        transactions.push({
                            date: date,
                            description: match[2].trim(),
                            value: value,
                            type: 'expense'
                        });
                    }
                }
            }
        }
    }

    if (pendingBBTransaction) transactions.push(pendingBBTransaction);

    for (let i = 0; i < transactions.length; i++) {
        const t = transactions[i];
        if (!t.description || t.description.trim() === '') t.description = 'Transação';
        t.description = t.description.replace(/^\d{2}\/\d{2}\s\d{2}:\d{2}\s?/, '');
    }

    return transactions;
}
