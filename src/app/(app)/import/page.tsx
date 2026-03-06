"use client";

import { useState } from "react";
import {
    FileUp,
    Upload,
    Check,
    X,
    Loader2,
    AlertCircle,
    ArrowUpCircle,
    ArrowDownCircle,
    Tag,
    FileText,
    CreditCard,
    Building2,
    Lightbulb
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import { parseOFX, parseCSV, parsePDF, suggestCategory, Transaction } from "@/lib/parser";

const INCOME_CATEGORIES = ["Salário", "Renda Extra", "Aposentadoria / Investimentos", "Outros"];

const EXPENSE_CATEGORIES = {
    "Essenciais (50%)": [
        "Alimentação", "Moradia", "Saúde", "Transporte", "Educação",
        "Contas Básicas", "Seguros", "Impostos e Taxas", "Farmácia",
        "Manutenção do Lar", "Vestuário Básico", "Outro (Essencial)"
    ],
    "Estilo de Vida (30%)": [
        "Lazer", "Cuidados Pessoais", "Compras", "Assinaturas",
        "Viagens", "Restaurantes", "Streaming", "Hobbies",
        "Academia/Esportes", "Pets", "Presentes", "Eventos e Festas",
        "Delivery", "Beleza e Estética", "Cartão de Crédito", "Outro (Estilo de Vida)"
    ],
    "Poupança/Dívidas (20%)": [
        "Dívidas", "Reserva", "Outro (Poupança)"
    ]
};

const getBucket = (category: string) => {
    if (EXPENSE_CATEGORIES["Essenciais (50%)"].includes(category)) return "Essenciais";
    if (EXPENSE_CATEGORIES["Estilo de Vida (30%)"].includes(category)) return "Estilo de Vida";
    return "Poupança";
};

type ImportMode = "bank" | "credit_card";

interface ImportTransaction extends Transaction {
    id: string;
    selected: boolean;
    category: string;
    suggestedCategory?: string;
}

export default function ImportPage() {
    const [importMode, setImportMode] = useState<ImportMode>("bank");
    const [transactions, setTransactions] = useState<ImportTransaction[]>([]);
    const [isParsing, setIsParsing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const supabase = createClient();

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // Reset input so same file can be re-uploaded
        e.target.value = "";

        setIsParsing(true);
        setError(null);
        setTransactions([]);

        try {
            let parsed: Transaction[] = [];
            const lower = file.name.toLowerCase();

            if (lower.endsWith('.ofx')) {
                const content = await file.text();
                parsed = parseOFX(content);
            } else if (lower.endsWith('.csv')) {
                const content = await file.text();
                parsed = parseCSV(content);
            } else if (lower.endsWith('.pdf')) {
                parsed = await parsePDF(file);
            } else {
                throw new Error("Formato de arquivo não suportado. Use .pdf, .ofx ou .csv");
            }

            if (parsed.length === 0) {
                throw new Error("Nenhuma transação encontrada no arquivo. Verifique se o formato está correto.");
            }

            setTransactions(parsed.map((t, i) => {
                const suggested = importMode === "credit_card" && t.type === "expense"
                    ? suggestCategory(t.description)
                    : "";
                return {
                    ...t,
                    id: `import-${i}`,
                    selected: true,
                    category: suggested,
                    suggestedCategory: suggested || undefined,
                };
            }));
        } catch (err: any) {
            setError(err.message || "Erro ao processar arquivo.");
        } finally {
            setIsParsing(false);
        }
    };

    const toggleSelect = (id: string) => {
        setTransactions(prev => prev.map(t =>
            t.id === id ? { ...t, selected: !t.selected } : t
        ));
    };

    const updateCategory = (id: string, category: string) => {
        setTransactions(prev => prev.map(t =>
            t.id === id ? { ...t, category } : t
        ));
    };

    const toggleType = (id: string) => {
        setTransactions(prev => prev.map(t =>
            t.id === id ? { ...t, type: t.type === 'income' ? 'expense' : 'income', category: "", suggestedCategory: undefined } : t
        ));
    };

    const handleSave = async () => {
        const selectedTransactions = transactions.filter(t => t.selected);
        if (selectedTransactions.length === 0) return;

        const invalid = selectedTransactions.some(t => t.category === "");
        if (invalid) {
            alert("Por favor, selecione uma categoria para todas as transações selecionadas.");
            return;
        }

        setIsSaving(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        try {
            const expenses = selectedTransactions.filter(t => t.type === 'expense');
            const incomes = selectedTransactions.filter(t => t.type === 'income');

            if (expenses.length > 0) {
                const expenseData = expenses.map(t => ({
                    user_id: user.id,
                    value: t.value,
                    date: t.date.toISOString().split('T')[0],
                    description: `${t.category} - ${t.description}`,
                    category_type: getBucket(t.category)
                }));

                const { error: expError } = await supabase.from('expenses').insert(expenseData);
                if (expError) throw expError;
            }

            if (incomes.length > 0) {
                const incomeData = incomes.map(t => ({
                    user_id: user.id,
                    value: t.value,
                    date: t.date.toISOString().split('T')[0],
                    description: t.description,
                    category: t.category
                }));

                const { error: incError } = await supabase.from('incomes').insert(incomeData);
                if (incError) throw incError;
            }

            alert(`${selectedTransactions.length} transações importadas com sucesso!`);
            setTransactions([]);
        } catch (err: any) {
            console.error(err);
            alert("Erro ao salvar transações: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const selectedCount = transactions.filter(t => t.selected).length;
    const suggestedCount = transactions.filter(t => t.suggestedCategory && t.category === t.suggestedCategory).length;

    return (
        <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2.5 rounded-lg text-primary">
                    <FileUp className="w-8 h-8" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold">Importar Extrato</h1>
                    <p className="text-muted-foreground mt-1">Adicione receitas e despesas automaticamente via PDF, OFX ou CSV</p>
                </div>
            </div>

            {/* Mode Selector */}
            {transactions.length === 0 && (
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Tipo de extrato</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                            onClick={() => setImportMode("bank")}
                            className={cn(
                                "flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left",
                                importMode === "bank"
                                    ? "border-primary bg-primary/5 text-primary"
                                    : "border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <div className={cn("p-2.5 rounded-lg", importMode === "bank" ? "bg-primary/10" : "bg-muted")}>
                                <Building2 className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="font-semibold text-foreground">Extrato Bancário</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Nubank, Inter, Bradesco, Itaú…</p>
                            </div>
                        </button>

                        <button
                            onClick={() => setImportMode("credit_card")}
                            className={cn(
                                "flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left",
                                importMode === "credit_card"
                                    ? "border-primary bg-primary/5 text-primary"
                                    : "border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <div className={cn("p-2.5 rounded-lg", importMode === "credit_card" ? "bg-primary/10" : "bg-muted")}>
                                <CreditCard className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="font-semibold text-foreground">Cartão de Crédito</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Fatura com sugestão de categorias</p>
                            </div>
                        </button>
                    </div>
                </div>
            )}

            {/* Upload area */}
            {transactions.length === 0 && (
                <div className="bg-card border border-border rounded-xl p-8 shadow-sm text-center">
                    {!isParsing ? (
                        <div className="max-w-md mx-auto relative group">
                            <input
                                type="file"
                                accept=".ofx,.csv,.pdf"
                                onChange={handleFileUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className="border-2 border-dashed border-border group-hover:border-primary/50 group-hover:bg-primary/5 transition-all rounded-xl p-10 flex flex-col items-center gap-4">
                                <div className={cn("p-4 rounded-full", importMode === "credit_card" ? "bg-purple-500/10 text-purple-500" : "bg-primary/10 text-primary")}>
                                    {importMode === "credit_card" ? <CreditCard className="w-8 h-8" /> : <Upload className="w-8 h-8" />}
                                </div>
                                <div>
                                    <p className="font-semibold text-lg">Clique para fazer upload ou arraste o arquivo</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {importMode === "credit_card"
                                            ? "Fatura do cartão em .PDF ou .CSV · Categorias sugeridas automaticamente"
                                            : "Extrato bancário em .PDF, .OFX ou .CSV"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="py-10 flex flex-col items-center gap-4">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            <p className="font-medium">Processando seu arquivo{importMode === "credit_card" ? " e analisando categorias" : ""}...</p>
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 p-4 bg-destructive/10 text-destructive rounded-lg flex items-center justify-center gap-2">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <p>{error}</p>
                        </div>
                    )}
                </div>
            )}

            {/* Transactions table */}
            {transactions.length > 0 && (
                <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b bg-muted/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div>
                            <h2 className="font-bold text-lg flex items-center gap-2">
                                {importMode === "credit_card" ? <CreditCard className="w-5 h-5 text-purple-500" /> : <Building2 className="w-5 h-5 text-primary" />}
                                Revisar Transações ({transactions.length})
                            </h2>
                            {importMode === "credit_card" && suggestedCount > 0 && (
                                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                    <Lightbulb className="w-3 h-3 text-yellow-500" />
                                    {suggestedCount} categorias sugeridas automaticamente · você pode alterá-las
                                </p>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setTransactions([])}
                                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-6 py-2 bg-primary text-primary-foreground font-bold rounded-lg flex items-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Salvar {selectedCount > 0 ? `(${selectedCount})` : "Selecionados"}</>}
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-muted/50 text-xs font-bold text-muted-foreground uppercase border-b">
                                    <th className="px-4 py-3 w-10 text-center">
                                        <input
                                            type="checkbox"
                                            className="rounded border-border"
                                            checked={transactions.every(t => t.selected)}
                                            onChange={(e) => setTransactions(prev => prev.map(t => ({ ...t, selected: e.target.checked })))}
                                        />
                                    </th>
                                    <th className="px-4 py-3">Tipo</th>
                                    <th className="px-4 py-3">Data</th>
                                    <th className="px-4 py-3">Descrição</th>
                                    <th className="px-4 py-3">Valor</th>
                                    <th className="px-4 py-3">Categoria</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {transactions.map((t) => (
                                    <tr key={t.id} className={cn("hover:bg-muted/30 transition-colors", !t.selected && "opacity-50")}>
                                        <td className="px-4 py-4 text-center">
                                            <input
                                                type="checkbox"
                                                className="rounded border-border"
                                                checked={t.selected}
                                                onChange={() => toggleSelect(t.id)}
                                            />
                                        </td>
                                        <td className="px-4 py-4">
                                            <button
                                                onClick={() => toggleType(t.id)}
                                                className={cn(
                                                    "p-2 rounded-lg transition-all",
                                                    t.type === 'income' ? "bg-success/10 text-success hover:bg-success/20" : "bg-destructive/10 text-destructive hover:bg-destructive/20"
                                                )}
                                                title="Alternar entre Receita/Despesa"
                                            >
                                                {t.type === 'income' ? <ArrowDownCircle className="w-5 h-5" /> : <ArrowUpCircle className="w-5 h-5" />}
                                            </button>
                                        </td>
                                        <td className="px-4 py-4 text-sm font-medium">
                                            {t.date.toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-sm line-clamp-1">{t.description}</span>
                                                <span className="text-[10px] text-muted-foreground flex items-center gap-1 uppercase">
                                                    {importMode === "credit_card"
                                                        ? <><CreditCard className="w-3 h-3" /> Fatura do Cartão</>
                                                        : <><FileText className="w-3 h-3" /> Transação do Banco</>
                                                    }
                                                </span>
                                            </div>
                                        </td>
                                        <td className={cn("px-4 py-4 font-bold text-lg whitespace-nowrap", t.type === 'income' ? "text-success" : "text-destructive")}>
                                            {t.type === 'income' ? '+' : '-'} R$ {t.value.toFixed(2).replace('.', ',')}
                                        </td>
                                        <td className="px-4 py-4 min-w-[220px]">
                                            <div className="relative">
                                                {/* Suggested category badge */}
                                                {t.suggestedCategory && t.category === t.suggestedCategory && (
                                                    <span className="absolute -top-4 left-0 text-[10px] font-bold text-yellow-600 dark:text-yellow-400 flex items-center gap-0.5">
                                                        <Lightbulb className="w-2.5 h-2.5" /> Sugestão
                                                    </span>
                                                )}
                                                <Tag className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                                                <select
                                                    value={t.category}
                                                    onChange={(e) => updateCategory(t.id, e.target.value)}
                                                    className={cn(
                                                        "w-full bg-background border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none",
                                                        t.suggestedCategory && t.category === t.suggestedCategory
                                                            ? "border-yellow-400/60 dark:border-yellow-500/40"
                                                            : "border-border"
                                                    )}
                                                >
                                                    <option value="">Selecionar...</option>
                                                    {t.type === 'income' ? (
                                                        <>
                                                            <optgroup label="Categorias de Receita">
                                                                {INCOME_CATEGORIES.map(cat => (
                                                                    <option key={cat} value={cat}>{cat}</option>
                                                                ))}
                                                            </optgroup>
                                                        </>
                                                    ) : (
                                                        <>
                                                            {Object.entries(EXPENSE_CATEGORIES).map(([group, cats]) => (
                                                                <optgroup key={group} label={group}>
                                                                    {cats.map(cat => (
                                                                        <option key={cat} value={cat}>{cat}</option>
                                                                    ))}
                                                                </optgroup>
                                                            ))}
                                                        </>
                                                    )}
                                                </select>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
