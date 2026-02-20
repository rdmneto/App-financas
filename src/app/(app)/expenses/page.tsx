"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { ArrowUpCircle, Plus, Calendar, DollarSign, Tag, FileText, Info, Loader2, Edit2, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";

type ExpenseFormData = {
    value: number;
    date: string;
    description: string;
    category: string;
    is_recurring: boolean;
};

// 50/30/20 Classification helper
const getBucket = (category: string) => {
    const essentials = ["Alimentação", "Moradia", "Saúde", "Transporte", "Educação"];
    const lifestyle = ["Lazer", "Cuidados Pessoais", "Compras", "Assinaturas"];

    if (essentials.includes(category)) return { name: "Essenciais", color: "bg-blue-500", text: "text-blue-500", limit: "50%" };
    if (lifestyle.includes(category)) return { name: "Estilo de Vida", color: "bg-purple-500", text: "text-purple-500", limit: "30%" };
    return { name: "Poupança", color: "bg-emerald-500", text: "text-emerald-500", limit: "20%" };
};

type Expense = {
    id: string;
    value: number;
    date: string;
    description: string;
    category: string;
    bucket: string;
    is_recurring?: boolean;
    recurrence_end_date?: string | null;
    is_virtual?: boolean;
    original_id?: string;
};

export default function ExpensesPage() {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const supabase = createClient();

    const { register, handleSubmit, reset } = useForm<ExpenseFormData>();

    useEffect(() => {
        async function loadExpenses() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('expenses')
                .select('*')
                .order('date', { ascending: false });

            if (!error && data) {
                let mappedData: Expense[] = [];
                const now = new Date();
                const currentYear = now.getFullYear();
                const currentMonth = now.getMonth();

                data.forEach((d: any) => {
                    // Extract original category from description if prepended, else use category_type
                    let originalCategory = "Outros";
                    let originalDesc = d.description;
                    if (d.description.includes(" - ")) {
                        const parts = d.description.split(" - ");
                        originalCategory = parts[0];
                        originalDesc = parts.slice(1).join(" - ");
                    }

                    const baseExpense: Expense = {
                        id: d.id,
                        value: d.value,
                        date: d.date,
                        description: originalDesc,
                        category: originalCategory,
                        bucket: d.category_type,
                        is_recurring: d.is_recurring,
                        recurrence_end_date: d.recurrence_end_date
                    };

                    mappedData.push(baseExpense);

                    // Generate virtual recurring expenses
                    if (d.is_recurring) {
                        const startDate = new Date(d.date);
                        // Convert DB date safely assuming it was local when posted or UTC depending on how it was saved
                        // It's safest to parse the exact YYYY-MM-DD string to avoid timezone shifts
                        const [yearStr, monthStr, dayStr] = d.date.split('-');
                        let loopDate = new Date(Number(yearStr), Number(monthStr) - 1, Number(dayStr.split('T')[0]));

                        // Advance loopDate by 1 month to start generating copies
                        loopDate.setMonth(loopDate.getMonth() + 1);

                        // Stop either at recurrence_end_date OR the current month (don't generate future months)
                        let endLimit = new Date(currentYear, currentMonth, loopDate.getDate());
                        if (d.recurrence_end_date) {
                            const [ey, em, ed] = d.recurrence_end_date.split('-');
                            const cancelDate = new Date(Number(ey), Number(em) - 1, Number(ed.split('T')[0]));
                            if (cancelDate < endLimit) {
                                endLimit = cancelDate;
                            }
                        }

                        while (
                            (loopDate.getFullYear() < endLimit.getFullYear()) ||
                            (loopDate.getFullYear() === endLimit.getFullYear() && loopDate.getMonth() <= endLimit.getMonth())
                        ) {
                            // If the endLimit is this exact month, make sure the day hasn't passed if we consider cancelDate EXACT.
                            // But usually, monthly recurrence stops the month AFTER cancel. Let's just use month/year.
                            if (d.recurrence_end_date) {
                                const cancelDate = new Date(d.recurrence_end_date);
                                if (loopDate > cancelDate) break;
                            }

                            if (loopDate > now) break; // Final safeguard against future projection

                            const virtualDateStr = `${loopDate.getFullYear()}-${String(loopDate.getMonth() + 1).padStart(2, '0')}-${String(loopDate.getDate()).padStart(2, '0')}`;
                            mappedData.push({
                                ...baseExpense,
                                id: `${d.id}-virtual-${virtualDateStr}`,
                                date: virtualDateStr,
                                is_virtual: true,
                                original_id: d.id
                            });

                            loopDate.setMonth(loopDate.getMonth() + 1);
                        }
                    }
                });

                // Re-sort after adding virtuals
                mappedData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setExpenses(mappedData);
            }
            setIsLoading(false);
        }
        loadExpenses();
    }, []);

    const onSubmit = async (data: ExpenseFormData) => {
        setIsSubmitting(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const bucketInfo = getBucket(data.category);

        const newExpenseRecord = {
            user_id: user.id,
            value: Number(data.value),
            date: data.date,
            description: `${data.category} - ${data.description}`,
            category_type: bucketInfo.name,
            is_recurring: data.is_recurring || false
        };

        const updateExpenseRecord: any = {
            value: Number(data.value),
            date: data.date,
            description: `${data.category} - ${data.description}`,
            category_type: bucketInfo.name,
            is_recurring: data.is_recurring || false
        };

        if (editingId) {
            // Se o usuário está (re)ativando a recorrência numa edição, limpamos o cancelamento
            if (data.is_recurring) {
                updateExpenseRecord.recurrence_end_date = null;
            }

            const { data: updatedData, error } = await supabase
                .from('expenses')
                .update(updateExpenseRecord)
                .eq('id', editingId)
                .select('*');

            if (!error) {
                // To safely update the UI with complex virtuals, we reload the whole page list.
                window.location.reload();
            } else {
                console.error("Supabase Edit Error:", error);
                alert("Erro ao atualizar despesa: " + (error?.message || "Erro desconhecido"));
            }
        } else {
            const { data: insertedData, error } = await supabase
                .from('expenses')
                .insert(newExpenseRecord)
                .select('*');

            if (!error) {
                window.location.reload();
            } else {
                console.error("Supabase Insert Error:", error);
                alert("Erro ao salvar despesa: " + (error?.message || "Erro desconhecido"));
            }
        }
        setIsSubmitting(false);
    };

    const editExpense = (expense: Expense) => {
        if (expense.is_virtual) {
            alert("Não é possível editar uma ocorrência mensal repetida. Edite o lançamento original.");
            return;
        }
        setEditingId(expense.id);
        reset({
            description: expense.description,
            value: expense.value,
            date: expense.date,
            category: expense.category,
            is_recurring: expense.is_recurring
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => {
        setEditingId(null);
        reset({ description: "", value: "" as any, date: "", category: "", is_recurring: false });
    };

    const deleteExpense = async (id: string, isVirtual?: boolean, originalId?: string) => {
        if (isVirtual) {
            alert("Para excluir, você deve excluir o lançamento original, ou cancelar a assinatura.");
            return;
        }
        if (!confirm("Tem certeza que deseja excluir esta despesa? Lançamentos repetidos dessa despesa também sumirão.")) return;

        setIsLoading(true);
        const { error } = await supabase.from('expenses').delete().eq('id', id);
        if (!error) {
            // Filter out both the original and any virtual children
            setExpenses(expenses.filter(e => e.id !== id && e.original_id !== id));
        } else {
            alert("Erro ao excluir despesa.");
        }
        setIsLoading(false);
    };

    const cancelRecurrence = async (id: string, isVirtual?: boolean, originalId?: string) => {
        const targetId = isVirtual ? originalId : id;
        if (!targetId) return;

        if (!confirm("Deseja cancelar esta assinatura? Ela deixará de ser cobrada a partir de hoje.")) return;
        setIsLoading(true);

        const now = new Date();
        const cancelDateStr = now.toISOString();

        const { error } = await supabase
            .from('expenses')
            .update({ recurrence_end_date: cancelDateStr })
            .eq('id', targetId);

        if (!error) {
            window.location.reload();
        } else {
            alert("Erro ao cancelar assinatura.");
        }
        setIsLoading(false);
    };

    // Calculate totals dynamically from current state array instead of static variables
    const totalExpenses = useMemo(() => expenses.reduce((acc, curr) => acc + curr.value, 0), [expenses]);
    const totalEssentials = useMemo(() => expenses.filter(e => getBucket(e.category).name === "Essenciais").reduce((acc, curr) => acc + curr.value, 0), [expenses]);
    const totalLifestyle = useMemo(() => expenses.filter(e => getBucket(e.category).name === "Estilo de Vida").reduce((acc, curr) => acc + curr.value, 0), [expenses]);
    const totalSavings = useMemo(() => expenses.filter(e => getBucket(e.category).name === "Poupança" || e.category.includes("Poupança")).reduce((acc, curr) => acc + curr.value, 0), [expenses]);
    const total = totalEssentials + totalLifestyle + totalSavings;

    return (
        <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-3">
                <div className="bg-destructive/10 p-2.5 rounded-lg text-destructive">
                    <ArrowUpCircle className="w-8 h-8" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold">Despesas</h1>
                    <p className="text-muted-foreground mt-1">Controle seus gastos com a regra 50/30/20</p>
                </div>
            </div>

            {/* 50/30/20 Visualizer */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        Organização 50/30/20 <span title="50% Essenciais, 30% Estilo de Vida, 20% Poupança"><Info className="w-4 h-4 text-muted-foreground cursor-help" /></span>
                    </h2>
                    <span className="font-bold text-lg">Total: R$ {total.toFixed(2).replace('.', ',')}</span>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-3">
                    <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                            <span className="font-medium text-blue-500 text-xs md:text-sm">Essenciais (50%)</span>
                            <span className="font-medium">R$ {totalEssentials.toFixed(2).replace('.', ',')}</span>
                        </div>
                        <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500" style={{ width: '50%' }}></div>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                            <span className="font-medium text-purple-500 text-xs md:text-sm">Estilo de Vida (30%)</span>
                            <span className="font-medium">R$ {totalLifestyle.toFixed(2).replace('.', ',')}</span>
                        </div>
                        <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500" style={{ width: '30%' }}></div>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                            <span className="font-medium text-emerald-500 text-xs md:text-sm">Poupança/Dívidas (20%)</span>
                            <span className="font-medium">R$ {totalSavings.toFixed(2).replace('.', ',')}</span>
                        </div>
                        <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: '20%' }}></div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form elements */}
                <div className="lg:col-span-1 bg-card border border-border rounded-xl p-6 shadow-sm h-fit">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <Plus className="w-5 h-5 text-destructive" /> Nova Despesa
                    </h2>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Valor</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-destructive/50"
                                    {...register("value", { required: true, min: 0.01 })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Data</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                                <input
                                    type="date"
                                    className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-destructive/50"
                                    {...register("date", { required: true })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Categoria</label>
                            <div className="relative">
                                <Tag className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                                <select
                                    className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-destructive/50 appearance-none"
                                    {...register("category", { required: true })}
                                >
                                    <option value="">Selecione...</option>
                                    <optgroup label="Essenciais (50%)">
                                        <option value="Alimentação">Alimentação</option>
                                        <option value="Moradia">Moradia</option>
                                        <option value="Saúde">Saúde</option>
                                        <option value="Transporte">Transporte</option>
                                        <option value="Educação">Educação</option>
                                    </optgroup>
                                    <optgroup label="Estilo de Vida (30%)">
                                        <option value="Lazer">Lazer</option>
                                        <option value="Cuidados Pessoais">Cuidados Pessoais</option>
                                        <option value="Compras">Compras</option>
                                        <option value="Assinaturas">Assinaturas</option>
                                    </optgroup>
                                    <optgroup label="Poupança/Dívidas (20%)">
                                        <option value="Dívidas">Quitação de Dívidas</option>
                                        <option value="Reserva">Reserva de Emergência</option>
                                    </optgroup>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Descrição</label>
                            <div className="relative">
                                <FileText className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Ex: Compra do Mês"
                                    className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-destructive/50"
                                    {...register("description", { required: true })}
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 pb-1">
                            <input
                                type="checkbox"
                                id="is_recurring"
                                className="w-4 h-4 rounded border-border text-destructive focus:ring-destructive"
                                {...register("is_recurring")}
                            />
                            <label htmlFor="is_recurring" className="text-sm text-foreground">Repetir todo mês (Ex: Assinatura)</label>
                        </div>

                        <div className="flex gap-2 mt-4">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex-1 bg-destructive text-destructive-foreground font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 hover:bg-destructive/90 transition-all disabled:opacity-70"
                            >
                                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : editingId ? <><Edit2 className="w-5 h-5" /> Atualizar</> : <><Plus className="w-5 h-5" /> Adicionar Despesa</>}
                            </button>
                            {editingId && (
                                <button
                                    type="button"
                                    onClick={cancelEdit}
                                    className="px-4 bg-muted text-muted-foreground hover:text-foreground font-semibold rounded-lg flex items-center justify-center hover:bg-muted/80 transition-all border border-border"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* List of Expenses */}
                <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col">
                    <h2 className="text-xl font-bold mb-4">Histórico de Saídas</h2>

                    <div className="flex-1 overflow-auto pr-2 space-y-3">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-10">
                                <Loader2 className="w-8 h-8 text-destructive animate-spin" />
                            </div>
                        ) : expenses.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground">
                                <ArrowUpCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>Nenhuma despesa registrada ainda.</p>
                            </div>
                        ) : (
                            expenses.map((expense) => {
                                const bucketInfo = getBucket(expense.category);
                                const isCancelled = expense.is_recurring && expense.recurrence_end_date;

                                return (
                                    <div key={expense.id} className={cn("flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-background border rounded-xl gap-3 transition-colors group", expense.is_virtual ? "border-dashed border-muted-foreground/30 bg-muted/10 opacity-80" : "border-border hover:border-destructive/30")}>
                                        <div className="flex items-center gap-4">
                                            <div className="bg-destructive/10 p-2.5 rounded-full text-destructive">
                                                <ArrowUpCircle className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold text-foreground">{expense.description}</h3>
                                                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium bg-muted", bucketInfo.text)}>
                                                        {bucketInfo.name}
                                                    </span>
                                                    {expense.is_virtual && (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-500/10 text-purple-500 border border-purple-500/20">
                                                            Mensal (Automático)
                                                        </span>
                                                    )}
                                                    {(!expense.is_virtual && expense.is_recurring) && (
                                                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold border", isCancelled ? "bg-muted text-muted-foreground border-transparent" : "bg-purple-500/10 text-purple-500 border-purple-500/20")}>
                                                            {isCancelled ? "Assinatura Cancelada" : "Plano Recorrente"}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                                    <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{expense.category}</span>
                                                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(expense.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between sm:justify-end gap-4 mt-2 sm:mt-0">
                                            <div className="sm:text-right font-bold text-destructive text-lg whitespace-nowrap">
                                                - R$ {Number(expense.value).toFixed(2).replace('.', ',')}
                                            </div>
                                            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                {(!isCancelled && (expense.is_recurring || expense.is_virtual)) && (
                                                    <button onClick={() => cancelRecurrence(expense.id, expense.is_virtual, expense.original_id)} className="p-2 text-muted-foreground hover:text-orange-500 bg-muted/50 hover:bg-muted rounded-md transition-colors" title="Cancelar Assinatura">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {!expense.is_virtual && (
                                                    <button onClick={() => editExpense(expense)} className="p-2 text-muted-foreground hover:text-primary bg-muted/50 hover:bg-muted rounded-md transition-colors" title="Editar">
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button onClick={() => deleteExpense(expense.id, expense.is_virtual, expense.original_id)} className="p-2 text-muted-foreground hover:text-destructive bg-muted/50 hover:bg-muted rounded-md transition-colors" title="Excluir Lançamento">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
