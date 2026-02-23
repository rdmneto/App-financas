export interface Transaction {
    date: Date;
    description: string;
    value: number;
    type: 'income' | 'expense';
}

export function parseOFX(content: string): Transaction[] {
    const transactions: Transaction[] = [];

    // Basic split by <STMTTRN> block
    const blocks = content.split('<STMTTRN>');
    blocks.shift(); // Remove content before first block

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

export function parseCSV(content: string): Transaction[] {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length < 2) return [];

    // Try to determine separator
    const firstLine = lines[0];
    const separator = firstLine.includes(';') ? ';' : ',';

    const headers = firstLine.toLowerCase().split(separator);

    // Find column indices
    const dateIdx = headers.findIndex(h => h.includes('data') || h.includes('date'));
    const descIdx = headers.findIndex(h => h.includes('desc') || h.includes('memo') || h.includes('nome') || h.includes('estabelecimento'));
    const valueIdx = headers.findIndex(h => h.includes('valor') || h.includes('amount') || h.includes('value'));

    if (dateIdx === -1 || descIdx === -1 || valueIdx === -1) {
        // Fallback or generic error handling could go here
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

        // Handle different date formats (simple DD/MM/YYYY or YYYY-MM-DD)
        let date: Date;
        if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts[0].length === 4) {
                // YYYY/MM/DD
                date = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0));
            } else {
                // DD/MM/YYYY
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
