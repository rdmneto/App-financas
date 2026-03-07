"use server";

// Use require to bypass missing type definition for legacy build path
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

interface Transaction {
    date: Date;
    description: string;
    value: number;
    type: 'income' | 'expense';
}

function parsePDFText(text: string): Transaction[] {
    const transactions: Transaction[] = [];
    const lines = text.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(l => l.length > 5);

    const patternBBPending = /^(\d{2}\/\d{2}\/\d{4})\s+([\d{1,3}(?:\.\d{3})*,\d{2}]+)\s*\(([-+])\)/;
    const patternFull = /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([-+]?\s*\d{1,3}(?:\.\d{3})*,\d{2})\s*$/;
    const patternShort = /(\d{2}\s+[A-Za-z]{3})\s+(.+?)\s+R?\$?\s*([\d.,]+)\s*$/i;

    const monthMap: Record<string, number> = {
        jan: 0, fev: 1, feb: 1, mar: 2, abr: 3, apr: 3, mai: 4, may: 4,
        jun: 5, jul: 6, ago: 7, aug: 7, set: 8, sep: 8, out: 9, oct: 9,
        nov: 10, dez: 11, dec: 11
    };
    const currentYear = new Date().getFullYear();

    let pendingBBTransaction: Transaction | null = null;

    for (const line of lines) {
        if (/^(?:saldo anterior|saldo final|saldo atual|extrato|resumo|cliente|cpf\s?:|cnpj\s?:|período|data\s+hist|saldo do dia)/i.test(line)) continue;
        if (line.includes("Saldo do dia") || line.includes("Saldo Anterior") || line.includes("S A L D O") || line.includes("Total Devido") || line.includes("Informações")) {
            if (pendingBBTransaction) {
                transactions.push(pendingBBTransaction);
                pendingBBTransaction = null;
            }
            continue;
        }

        const patternSicredi = /^(?!.*(?:Custo Efetivo|CET|Saldo))(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([-]?\d{1,3}(?:\.\d{3})*,\d{2})(?:\s+(\d{1,3}(?:\.\d{3})*,\d{2}))?$/i;
        if (line.match(patternSicredi)) { }

        let match = line.match(patternBBPending);
        if (match) {
            if (pendingBBTransaction) transactions.push(pendingBBTransaction);
            const [, dateStr, valStr, sign] = match;
            const [day, month, year] = dateStr.split('/').map(Number);
            const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
            const value = parseFloat(valStr.replace(/\./g, '').replace(',', '.'));

            if (!isNaN(date.getTime()) && !isNaN(value) && value > 0) {
                pendingBBTransaction = {
                    date,
                    description: '',
                    value,
                    type: sign === '-' ? 'expense' : 'income'
                };
            }
            continue;
        }

        if (pendingBBTransaction) {
            if (line.match(patternFull)) {
                transactions.push(pendingBBTransaction);
                pendingBBTransaction = null;
            } else {
                if (!line.match(/^\d+$/) && !line.includes("BB Rende Fácil") && !line.includes("Rende Facil") && !line.includes("Pix - Recebido") && !line.includes("Pix - Enviado") && !line.includes("Transferência enviada") && !line.includes("Transferência recebida")) {
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
            continue;
        }

        match = line.match(patternShort);
        if (match) {
            const [, dateStr, desc, valStr] = match;
            const parts = dateStr.trim().split(/\s+/);
            const day = parseInt(parts[0]);
            const monthKey = parts[1]?.toLowerCase().substring(0, 3);
            const month = monthMap[monthKey];

            if (month === undefined || isNaN(day)) continue;

            const date = new Date(Date.UTC(currentYear, month, day, 12, 0, 0));
            if (date > new Date()) date.setUTCFullYear(currentYear - 1);

            const value = parseFloat(valStr.replace('.', '').replace(',', '.'));
            if (isNaN(value) || value <= 0) continue;

            transactions.push({
                date,
                description: desc.trim(),
                value,
                type: 'expense'
            });
        }
    }

    if (pendingBBTransaction) transactions.push(pendingBBTransaction);

    return transactions.map(t => {
        if (!t.description || t.description.trim() === '') t.description = 'Transação';
        t.description = t.description.replace(/^\d{2}\/\d{2}\s\d{2}:\d{2}\s?/, '');
        return t;
    });
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
        return JSON.stringify({ success: true, transactions });
    } catch (e: any) {
        console.error("PDF Parsing Server Error:", e);
        return JSON.stringify({ success: false, error: e.message || "Failed to parse PDF on Server" });
    }
}
