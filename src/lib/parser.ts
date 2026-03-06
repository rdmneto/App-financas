export interface Transaction {
    date: Date;
    description: string;
    value: number;
    type: 'income' | 'expense';
}

// ---------------------------------------------------------------------------
// Category suggestion based on description keywords (for credit card import)
// ---------------------------------------------------------------------------
const KEYWORD_MAP: { keywords: string[]; category: string }[] = [
    { keywords: ['UBER', 'LYFT', '99POP', 'CABIFY', 'TAXI', '99 TAXI'], category: 'Transporte' },
    { keywords: ['IFOOD', 'RAPPI', 'DELIVERY', 'JAMES', 'LOGGI', 'UBEREATS', 'UBER EATS'], category: 'Delivery' },
    { keywords: ['NETFLIX', 'SPOTIFY', 'DEEZER', 'YOUTUBE PREMIUM', 'AMAZON PRIME', 'DISNEY', 'HBO', 'APPLE TV', 'PARAMOUNT', 'GLOBOPLAY', 'CRUNCHYROLL'], category: 'Streaming' },
    { keywords: ['SUPERMERCADO', 'EXTRA', 'ATACADAO', 'CARREFOUR', 'ASSAI', 'BIG', 'WAL MART', 'WALMART', 'PAGUE MENOS', 'HORTIFRUTI', 'MERCADO', 'SACOLAO', 'PAN DE AZUCAR'], category: 'Alimentação' },
    { keywords: ['FARMACIA', 'DROGARIA', 'DROGASIL', 'DROGA RAIA', 'PACHECO', 'ULTRAFARMA', 'REMEDIO'], category: 'Farmácia' },
    { keywords: ['POSTO', 'GASOLINA', 'COMBUSTIVEL', 'COMBUSTÍVEL', 'SHELL', 'PETROBRAS', 'IPIRANGA', 'BR DISTRIBUIDORA'], category: 'Transporte' },
    { keywords: ['ACADEMIA', 'GYM', 'SMARTFIT', 'BLUEFIT', 'BODYTECH', 'CROSSFIT'], category: 'Academia/Esportes' },
    { keywords: ['RESTAURANTE', 'LANCHONETE', 'PIZZARIA', 'CHURRASCARIA', 'SUSHI', 'HAMBURGUER', 'BURGER KING', 'MCDONALDS', "MC DONALD'S", 'SUBWAY', 'KFC', 'GIRAFFAS', 'BOB\'S', 'OUTBACK', 'CACAU SHOW'], category: 'Restaurantes' },
    { keywords: ['PADARIA', 'SORVETERIA', 'CAFETERIA', 'CAFE', 'STARBUCKS', 'DUNKIN'], category: 'Alimentação' },
    { keywords: ['SALAO', 'BARBEARIA', 'ESTETICA', 'ESTÉTICA', 'MANICURE', 'PEDICURE', 'BELEZA', 'SPA'], category: 'Beleza e Estética' },
    { keywords: ['PET', 'VETERINARIO', 'VETERINÁRIO', 'PETSHOP', 'COBASI', 'PETZ'], category: 'Pets' },
    { keywords: ['HOTEL', 'AIRBNB', 'HOSTEL', 'POUSADA', 'BOOKING'], category: 'Viagens' },
    { keywords: ['LATAM', 'GOL', 'AZUL', 'AVIANCA', 'AMERICAN AIRLINES', 'EMIRATES', 'AEROPORTO'], category: 'Viagens' },
    { keywords: ['EDUCAÇÃO', 'ESCOLA', 'FACULDADE', 'UNIVERSIDADE', 'CURSO', 'EAD', 'ALURA', 'UDEMY', 'COURSERA', 'DUOLINGO'], category: 'Educação' },
    { keywords: ['SEGURO', 'SEGUROS', 'PORTO SEGURO', 'BRADESCO SEGUROS', 'ITAU SEGUROS', 'SUI GENERIS'], category: 'Seguros' },
    { keywords: ['CINEMA', 'TEATRO', 'SHOW', 'INGRESSO', 'SYMPLA', 'BILHETERIA', 'TICKET'], category: 'Lazer' },
    { keywords: ['STEAM', 'PLAYSTATION', 'XBOX', 'NINTENDO', 'GAME', 'JOGOS'], category: 'Hobbies' },
    { keywords: ['AMAZON', 'SHOPEE', 'MERCADO LIVRE', 'AMERICANAS', 'MAGALU', 'MAGAZINE LUIZA', 'ALIEXPRESS', 'SHEIN'], category: 'Compras' },
    { keywords: ['ENERGIA', 'ELETRICIDADE', 'CPFL', 'CEMIG', 'COPEL', 'LIGHT S.A', 'ENEL', 'COELBA'], category: 'Contas Básicas' },
    { keywords: ['AGUA', 'SANEAMENTO', 'SABESP', 'CEDAE', 'CAGECE', 'EMBASA'], category: 'Contas Básicas' },
    { keywords: ['GAS', 'GÁS', 'COMGAS', 'CEGÁS'], category: 'Contas Básicas' },
    { keywords: ['INTERNET', 'CLARO', 'VIVO', 'TIM', 'OI ', 'NEXTEL', 'ALGAR', 'SKY', 'NET ', 'TELEFONE', 'TELEFÔNICO'], category: 'Contas Básicas' },
    { keywords: ['ALUGUEL', 'CONDOMINIO', 'CONDOMÍNIO', 'IPTU'], category: 'Moradia' },
    { keywords: ['PLANO DE SAUDE', 'PLANO DE SAÚDE', 'UNIMED', 'AMIL', 'SULAMERICA', 'BRADESCO SAUDE', 'HAPVIDA'], category: 'Saúde' },
    { keywords: ['PRESENTE', 'GIFT', 'ANIVERSARIO', 'ANIVERSÁRIO'], category: 'Presentes' },
    { keywords: ['ASSINATURA', 'ADOBE', 'MICROSOFT', 'OFFICE 365', 'GOOGLE ONE', 'APPLE', 'ICLOUD'], category: 'Assinaturas' },
];

export function suggestCategory(description: string): string {
    const upper = description.toUpperCase();
    for (const entry of KEYWORD_MAP) {
        for (const kw of entry.keywords) {
            if (upper.includes(kw)) {
                return entry.category;
            }
        }
    }
    return '';
}

// ---------------------------------------------------------------------------
// OFX parser
// ---------------------------------------------------------------------------
export function parseOFX(content: string): Transaction[] {
    const transactions: Transaction[] = [];

    const blocks = content.split('<STMTTRN>');
    blocks.shift();

    for (const block of blocks) {
        const trnamtMatch = block.match(/<TRNAMT>([\d.-]+)/);
        const dtpostedMatch = block.match(/<DTPOSTED>(\d{8})/);
        const memoMatch = block.match(/<MEMO>([^<]+)/) || block.match(/<NAME>([^<]+)/);

        if (trnamtMatch && dtpostedMatch && memoMatch) {
            const value = parseFloat(trnamtMatch[1]);
            const dateStr = dtpostedMatch[1];
            const year = parseInt(dateStr.substring(0, 4));
            const month = parseInt(dateStr.substring(4, 6)) - 1;
            const day = parseInt(dateStr.substring(6, 8));

            const date = new Date(Date.UTC(year, month, day, 12, 0, 0));
            const description = memoMatch[1].trim();

            transactions.push({
                date,
                description,
                value: Math.abs(value),
                type: value >= 0 ? 'income' : 'expense'
            });
        }
    }

    return transactions;
}

// ---------------------------------------------------------------------------
// CSV parser
// ---------------------------------------------------------------------------
export function parseCSV(content: string): Transaction[] {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length < 2) return [];

    const firstLine = lines[0];
    const separator = firstLine.includes(';') ? ';' : ',';

    const headers = firstLine.toLowerCase().split(separator);

    const dateIdx = headers.findIndex(h => h.includes('data') || h.includes('date'));
    const descIdx = headers.findIndex(h => h.includes('desc') || h.includes('memo') || h.includes('nome') || h.includes('estabelecimento') || h.includes('lancamento') || h.includes('lançamento'));
    const valueIdx = headers.findIndex(h => h.includes('valor') || h.includes('amount') || h.includes('value'));

    if (dateIdx === -1 || descIdx === -1 || valueIdx === -1) {
        return [];
    }

    const transactions: Transaction[] = [];

    for (let i = 1; i < lines.length; i++) {
        const columns = lines[i].split(separator);
        if (columns.length <= Math.max(dateIdx, descIdx, valueIdx)) continue;

        const dateStr = columns[dateIdx].trim();
        const description = columns[descIdx].trim().replace(/^"(.*)"$/, '$1');
        const valueStr = columns[valueIdx].trim().replace(',', '.').replace(/^"(.*)"$/, '$1');
        const value = parseFloat(valueStr);

        if (isNaN(value)) continue;

        let date: Date;
        if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts[0].length === 4) {
                date = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0));
            } else {
                date = new Date(Date.UTC(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]), 12, 0, 0));
            }
        } else {
            date = new Date(dateStr + 'T12:00:00Z');
        }

        if (isNaN(date.getTime())) continue;

        transactions.push({
            date,
            description,
            value: Math.abs(value),
            type: value >= 0 ? 'income' : 'expense'
        });
    }

    return transactions;
}

// ---------------------------------------------------------------------------
// PDF parser (uses pdfjs-dist, runs in browser environment)
// ---------------------------------------------------------------------------
export async function parsePDF(file: File): Promise<Transaction[]> {
    // Dynamic import so Next.js doesn't try to SSR pdfjs
    const pdfjsLib = await import('pdfjs-dist');

    // Set the worker source to the jsdelivr CDN version to avoid bundling issues
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        let pageText = '';
        let lastY = -1;

        for (const item of textContent.items as any[]) {
            if (!('str' in item)) continue;

            // item.transform[5] is the Y-coordinate
            const currentY = item.transform[5];

            // If the Y coordinate changes significantly, treat as a new line
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

    return parsePDFText(fullText);
}

// ---------------------------------------------------------------------------
// Internal: attempt to parse raw text extracted from PDF
// Tries to find patterns: date + description + value
// ---------------------------------------------------------------------------
function parsePDFText(text: string): Transaction[] {
    const transactions: Transaction[] = [];

    // Normalize: collapse multiple spaces
    const lines = text.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(l => l.length > 5);

    // Pattern 1: DD/MM/YYYY ... value (e.g. Bradesco, Itaú, Santander PDF layout)
    // Example line: "15/02/2025  PIX RECEBIDO - JOAO SILVA   + 500,00"
    // Example line: "15/02/2025  COMPRA AMERICANAS  -250,00"
    const patternFull = /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([-+]?\s*[\d.,]+)\s*$/;

    // Pattern 2: DD/MM ... value (short date, e.g. Nubank, Inter credit card PDF)
    // Example line: "12 MAR   UBER TRIP   R$ 32,50"
    const patternShort = /(\d{2}\s+[A-Za-z]{3})\s+(.+?)\s+R?\$?\s*([\d.,]+)\s*$/i;

    const monthMap: Record<string, number> = {
        jan: 0, fev: 1, feb: 1, mar: 2, abr: 3, apr: 3, mai: 4, may: 4,
        jun: 5, jul: 6, ago: 7, aug: 7, set: 8, sep: 8, out: 9, oct: 9,
        nov: 10, dez: 11, dec: 11
    };

    const currentYear = new Date().getFullYear();

    for (const line of lines) {
        // Skip header or separator lines (only if they are clearly not transactions)
        if (/^(?:saldo anterior|saldo final|saldo atual|extrato|resumo|cliente|cpf\s?:|cnpj\s?:|período|data\s+hist)/i.test(line)) continue;

        // Pattern for Sicredi PDF statement
        // Example: "02/02/2026 PAGAMENTO PIX 08173733309 PEDRO ONOFRE MARQUES PIX_DEB -100,00 35.766,44"
        // Meaning: Date | Description | Document (optional, e.g. PIX_DEB) | Value | Balance (optional)
        // We prevent matching lines containing "Custo Efetivo Total", "CET", "Saldo" by using a negative lookahead
        const patternSicredi = /^(?!.*(?:Custo Efetivo|CET|Saldo))(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([-]?\d{1,3}(?:\.\d{3})*,\d{2})(?:\s+(\d{1,3}(?:\.\d{3})*,\d{2}))?$/i;

        let match = line.match(patternSicredi);
        if (match) {
            const [, dateStr, descRaw, valStr] = match;
            const [day, month, year] = dateStr.split('/').map(Number);
            const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

            // Clean value
            const cleanVal = valStr.replace(/\./g, '').replace(',', '.');
            const isNegative = cleanVal.startsWith('-');
            const value = parseFloat(cleanVal.replace(/[^0-9.]/g, ''));

            // The description might end with the Document code (e.g. "PIX_DEB"), so we try to clean it
            // Typically document codes don't have spaces, but descriptions might. Let's just keep the whole thing or trim the last word if it looks like a code
            const descParts = descRaw.trim().split(/\s+/);
            // If the last part has '_' or is all caps and short, it might be the document code, but let's just keep everything as description to be safe
            const description = descRaw.trim();

            if (!isNaN(date.getTime()) && !isNaN(value) && value > 0) {
                transactions.push({
                    date,
                    description,
                    value,
                    type: isNegative ? 'expense' : 'income'
                });
            }
            continue;
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
                transactions.push({
                    date,
                    description: desc.trim(),
                    value,
                    type: isNegative ? 'expense' : 'income'
                });
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
            // If parsed date is in the future, assume last year
            if (date > new Date()) date.setUTCFullYear(currentYear - 1);

            const value = parseFloat(valStr.replace('.', '').replace(',', '.'));
            if (isNaN(value) || value <= 0) continue;

            transactions.push({
                date,
                description: desc.trim(),
                // Credit card PDF lines are almost always expenses
                value,
                type: 'expense'
            });
        }
    }

    return transactions;
}
