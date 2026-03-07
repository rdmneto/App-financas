"use server";

// @ts-ignore - bypass path issue in build
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

interface Transaction {
    date: Date;
    description: string;
    value: number;
    type: 'income' | 'expense';
}

function parsePDFText(text: string): Transaction[] {
    const transactions: Transaction[] = [];

    // Normalize: collapse multiple spaces and filter very short lines
    const rawLines = text.split('\n');
    const lines: string[] = [];
    for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i].replace(/\s+/g, ' ').trim();
        if (line.length > 5) {
            lines.push(line);
        }
    }

    // Pattern definitions (synced with parser.ts)
    const patternBBPending = /^(\d{2}\/\d{2}\/\d{4})\s+([\d{1,3}(?:\.\d{3})*,\d{2}]+)\s*\(([-+])\)/;
    const patternFull = /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([-+]?\s*\d{1,3}(?:\.\d{3})*,\d{2})\s*$/;
    const patternShort = /(\d{2}\s+[A-Za-z]{3})\s+(.+?)\s+R?\$?\s*([\d.,]+)\s*$/i;
    const patternSicredi = /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([-]?\d{1,3}(?:\.\d{3})*,\d{2})(?:\s+(\d{1,3}(?:\.\d{3})*,\d{2}))?$/i;

    const monthMap: Record<string, number> = {
        jan: 0, fev: 1, feb: 1, mar: 2, abr: 3, apr: 3, mai: 4, may: 4,
        jun: 5, jul: 6, ago: 7, aug: 7, set: 8, sep: 8, out: 9, oct: 9,
        nov: 10, dez: 11, dec: 11
    };
    const currentYear = new Date().getFullYear();

    let pendingBBTransaction: Transaction | null = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip common headers
        if (/^(?:saldo anterior|saldo final|saldo atual|extrato|resumo|cliente|cpf\s?:|cnpj\s?:|período|data\s+hist|saldo do dia)/i.test(line)) continue;
        if (line.indexOf("Saldo do dia") !== -1 || line.indexOf("Saldo Anterior") !== -1 || line.indexOf("S A L D O") !== -1 || line.indexOf("Total Devido") !== -1 || line.indexOf("Informações") !== -1) {
            if (pendingBBTransaction) {
                transactions.push(pendingBBTransaction);
                pendingBBTransaction = null;
            }
            continue;
        }

        // Sicredi Check
        const sicrediMatch = line.match(patternSicredi);
        if (sicrediMatch) {
            if (line.indexOf("Custo Efetivo") === -1 && line.indexOf("CET") === -1 && line.indexOf("Saldo") === -1) {
                const dateParts = sicrediMatch[1].split('/');
                const date = new Date(Date.UTC(Number(dateParts[2]), Number(dateParts[1]) - 1, Number(dateParts[0]), 12, 0, 0));

                const cleanVal = sicrediMatch[3].replace(/\./g, '').replace(',', '.');
                const isNegative = cleanVal.indexOf('-') === 0;
                const value = Math.abs(parseFloat(cleanVal));

                if (!isNaN(date.getTime()) && !isNaN(value)) {
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
            if (pendingBBTransaction) transactions.push(pendingBBTransaction);
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

        // Normal Full Pattern
        match = line.match(patternFull);
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

        // Short Pattern (Date MonthShort)
        match = line.match(patternShort);
        if (match) {
            const parts = match[1].trim().split(/\s+/);
            const monthKey = parts[1] ? parts[1].toLowerCase().substring(0, 3) : '';
            const month = monthMap[monthKey];

            if (month !== undefined) {
                const date = new Date(Date.UTC(currentYear, month, parseInt(parts[0]), 12, 0, 0));
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

    if (pendingBBTransaction) transactions.push(pendingBBTransaction);

    for (let i = 0; i < transactions.length; i++) {
        const t = transactions[i];
        if (!t.description || t.description.trim() === '') t.description = 'Transação';
        t.description = t.description.replace(/^\d{2}\/\d{2}\s\d{2}:\d{2}\s?/, '');
    }

    return transactions;
}

// Ensure pdfjs won't clash by setting dummy worker config since we are purely server-side legacy
export async function parsePDFBufferServer(base64Data: string): Promise<string> {
    try {
        const buffer = Buffer.from(base64Data, "base64");
        const uint8Array = new Uint8Array(buffer);

        // Since we are running in Node (NextJS Server Action), we use legacy build
        const doc = await pdfjsLib.getDocument({
            data: uint8Array,
            useSystemFonts: true,
            standardFontDataUrl: `node_modules/pdfjs-dist/standard_fonts/`
        }).promise;

        let fullText = '';
        for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
            const page = await doc.getPage(pageNum);
            const textContent = await page.getTextContent();

            let pageText = '';
            let lastY = -1;

            const items = textContent.items || [];

            for (let i = 0; i < items.length; i++) {
                const item = items[i] as any;
                if (!item || !('str' in item)) continue;

                const currentY = item.transform && item.transform.length >= 6 ? item.transform[5] : lastY;

                if (lastY !== -1 && Math.abs(lastY - currentY) > 2) {
                    pageText += '\n';
                } else if (pageText.length > 0 && !pageText.endsWith('\n') && !pageText.endsWith(' ')) {
                    pageText += ' ';
                }

                pageText += item.str.trim() + ' ';
                lastY = currentY;
            }
            fullText += pageText + '\n';
        }

        const transactions = parsePDFText(fullText);
        // Correctly handle Date objects to be plain strings for JSON serialization
        const serialized = [];
        for (let i = 0; i < transactions.length; i++) {
            const t = transactions[i];
            serialized.push({
                date: t.date.toISOString(),
                description: t.description,
                value: t.value,
                type: t.type
            });
        }
        return JSON.stringify({ success: true, transactions: serialized });
    } catch (e: any) {
        console.error("PDF Parsing Server Error:", e);
        return JSON.stringify({ success: false, error: e.message || "Failed to parse PDF on Server" });
    }
}
