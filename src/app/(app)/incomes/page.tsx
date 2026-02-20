"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { ArrowDownCircle, Plus, Calendar, DollarSign, Tag, FileText, Loader2, Edit2, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";

type IncomeFormData = {
    value: number;
    date: string;
    description: string;
    category: string;
};

type Income = {
    // UUIDs instead of numbers for DB
    id: string;
    value: number;
    date: string;
    description: string;
    category: string;
};

export default function IncomesPage() {
    const [incomes, setIncomes] = useState<Income[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const supabase = createClient();

    const { register, handleSubmit, reset, formState: { errors } } = useForm<IncomeFormData>();

    useEffect(() => {
        async function loadIncomes() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('incomes')
                .select('*')
                .order('date', { ascending: false });

            if (!error && data) {
                setIncomes(data);
            }
            setIsLoading(false);
        }
        loadIncomes();
    }, []);

    const onSubmit = async (data: IncomeFormData) => {
        setIsSubmitting(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const incomeData = {
            user_id: user.id,
            value: Number(data.value),
            date: data.date,
            description: data.description,
            category: data.category
        };

        if (editingId) {
            const { data: updatedData, error } = await supabase
                .from('incomes')
                .update(incomeData)
                .eq('id', editingId)
                .select('*')
                .single();

            if (!error && updatedData) {
                setIncomes(incomes.map(i => i.id === editingId ? updatedData : i));
                setEditingId(null);
                reset({ description: "", value: "" as any, date: "", category: "" });
            } else {
                alert("Erro ao atualizar receita.");
            }
        } else {
            const { data: insertedData, error } = await supabase
                .from('incomes')
                .insert(incomeData)
                .select('*')
                .single();

            if (!error && insertedData) {
                setIncomes([insertedData, ...incomes]);
                reset({ description: "", value: "" as any, date: "", category: "" });
            } else {
                alert("Erro ao salvar receita.");
            }
        }
        setIsSubmitting(false);
    };

    const editIncome = (income: Income) => {
        setEditingId(income.id);
        reset({
            description: income.description,
            value: income.value,
            date: income.date,
            category: income.category
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => {
        setEditingId(null);
        reset({ description: "", value: "" as any, date: "", category: "" });
    };

    const deleteIncome = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir esta receita?")) return;
        const { error } = await supabase.from('incomes').delete().eq('id', id);
        if (!error) {
            setIncomes(incomes.filter(i => i.id !== id));
        } else {
            alert("Erro ao excluir receita.");
        }
    };

    return (
        <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-3">
                <div className="bg-success/10 p-2.5 rounded-lg text-success">
                    <ArrowDownCircle className="w-8 h-8" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold">Receitas</h1>
                    <p className="text-muted-foreground mt-1">Registre e acompanhe suas entradas de dinheiro</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form elements */}
                <div className="lg:col-span-1 bg-card border border-border rounded-xl p-6 shadow-sm h-fit">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <Plus className="w-5 h-5 text-success" /> Nova Receita
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
                                    className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-success/50"
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
                                    className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-success/50"
                                    {...register("date", { required: true })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Categoria</label>
                            <div className="relative">
                                <Tag className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                                <select
                                    className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-success/50 appearance-none"
                                    {...register("category", { required: true })}
                                >
                                    <option value="">Selecione...</option>
                                    <option value="Salário">Salário</option>
                                    <option value="Renda Extra">Renda Extra</option>
                                    <option value="Aposentadoria / Investimentos">Aposentadoria / Invest</option>
                                    <option value="Outros">Outros</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Descrição</label>
                            <div className="relative">
                                <FileText className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Ex: Salário de Fevereiro"
                                    className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-success/50"
                                    {...register("description", { required: true })}
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 mt-4">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex-1 bg-success text-success-foreground font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 hover:bg-success/90 transition-all disabled:opacity-70"
                            >
                                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : editingId ? <><Edit2 className="w-5 h-5" /> Atualizar</> : <><Plus className="w-5 h-5" /> Adicionar Receita</>}
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

                {/* List of Incomes */}
                <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col">
                    <h2 className="text-xl font-bold mb-4">Histórico de Entradas</h2>

                    <div className="flex-1 overflow-auto pr-2 space-y-3">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-10">
                                <Loader2 className="w-8 h-8 text-success animate-spin" />
                            </div>
                        ) : incomes.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground">
                                <ArrowDownCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>Nenhuma receita registrada ainda.</p>
                            </div>
                        ) : (
                            incomes.map((income) => (
                                <div key={income.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-background border border-border rounded-xl gap-3 hover:border-success/30 transition-colors group">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-success/10 p-2.5 rounded-full text-success">
                                            <ArrowDownCircle className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-foreground">{income.description}</h3>
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                                <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{income.category}</span>
                                                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(income.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between sm:justify-end gap-4 mt-2 sm:mt-0">
                                        <div className="sm:text-right font-bold text-success text-lg whitespace-nowrap">
                                            + R$ {Number(income.value).toFixed(2).replace('.', ',')}
                                        </div>
                                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => editIncome(income)} className="p-2 text-muted-foreground hover:text-primary bg-muted/50 hover:bg-muted rounded-md transition-colors" title="Editar">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => deleteIncome(income.id)} className="p-2 text-muted-foreground hover:text-destructive bg-muted/50 hover:bg-muted rounded-md transition-colors" title="Excluir">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
