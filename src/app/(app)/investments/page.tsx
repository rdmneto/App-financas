"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { TrendingUp, Plus, Calendar, DollarSign, Target, FileText, Loader2, Edit2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";

type InvestmentFormData = {
    goalName: string;
    value: number;
    date: string;
    yieldRate?: number;
    isAutoCorrecting: boolean;
};

type Investment = {
    id: string;
    goalName: string;
    value: number;
    date: string;
    progress: number;
    target: number;
    yieldRate?: number;
    isAutoCorrecting: boolean;
};

export default function InvestmentsPage() {
    const [investments, setInvestments] = useState<Investment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const supabase = createClient();

    const { register, handleSubmit, reset } = useForm<InvestmentFormData>();

    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => {
        async function loadInvestments() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('investments')
                .select('*')
                .order('date', { ascending: false });

            if (!error && data) {
                const mappedData = data.map((d: any) => ({
                    id: d.id,
                    goalName: d.goal_name.replace("Meta: ", ""), // Strip prefix for cleaner edit
                    value: d.value,
                    date: d.date,
                    progress: 0,
                    target: d.value * 5,
                    yieldRate: d.yield_rate,
                    isAutoCorrecting: d.is_auto_correcting
                }));
                setInvestments(mappedData);
            }
            setIsLoading(false);
        }
        loadInvestments();
    }, []);

    const onSubmit = async (data: InvestmentFormData) => {
        setIsSubmitting(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const investmentData = {
            user_id: user.id,
            goal_name: "Meta: " + data.goalName,
            value: Number(data.value),
            date: data.date,
            yield_rate: data.yieldRate ? Number(data.yieldRate) : null,
            is_auto_correcting: !!data.isAutoCorrecting,
        };

        if (editingId) {
            const { data: updatedData, error } = await supabase
                .from('investments')
                .update(investmentData)
                .eq('id', editingId)
                .select('*')
                .single();

            if (!error && updatedData) {
                const updatedMapped = {
                    id: updatedData.id,
                    goalName: updatedData.goal_name.replace("Meta: ", ""),
                    value: updatedData.value,
                    date: updatedData.date,
                    progress: 0,
                    target: updatedData.value * 5,
                    yieldRate: updatedData.yield_rate,
                    isAutoCorrecting: updatedData.is_auto_correcting
                };
                setInvestments(investments.map(inv => inv.id === editingId ? updatedMapped : inv));
                cancelEdit();
            } else {
                alert("Erro ao editar aplicação.");
            }
        } else {
            const { data: insertedData, error } = await supabase
                .from('investments')
                .insert(investmentData)
                .select('*')
                .single();

            if (!error && insertedData) {
                const newMappedInv = {
                    id: insertedData.id,
                    goalName: insertedData.goal_name.replace("Meta: ", ""),
                    value: insertedData.value,
                    date: insertedData.date,
                    progress: 0,
                    target: insertedData.value * 5,
                    yieldRate: insertedData.yield_rate,
                    isAutoCorrecting: insertedData.is_auto_correcting
                };
                setInvestments([newMappedInv, ...investments]);
                reset();
            } else {
                alert("Erro ao salvar aplicação.");
            }
        }
        setIsSubmitting(false);
    };

    const editInvestment = (inv: Investment) => {
        setEditingId(inv.id);
        reset({
            goalName: inv.goalName,
            value: inv.value,
            date: inv.date.split('T')[0],
            yieldRate: inv.yieldRate || undefined,
            isAutoCorrecting: inv.isAutoCorrecting
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => {
        setEditingId(null);
        reset({ goalName: "", value: undefined, date: "", yieldRate: undefined, isAutoCorrecting: false });
    };

    const deleteInvestment = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir esta aplicação?")) return;

        setIsLoading(true);
        const { error } = await supabase.from('investments').delete().eq('id', id);
        if (!error) {
            setInvestments(investments.filter(i => i.id !== id));
        } else {
            alert("Erro ao excluir aplicação.");
        }
        setIsLoading(false);
    };

    return (
        <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2.5 rounded-lg text-primary">
                    <TrendingUp className="w-8 h-8" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold">Aplicações e Metas</h1>
                    <p className="text-muted-foreground mt-1">Acompanhe seu dinheiro poupado para objetivos de longo prazo</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form elements */}
                <div className="lg:col-span-1 bg-card border border-border rounded-xl p-6 shadow-sm h-fit">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <Plus className="w-5 h-5 text-primary" /> {editingId ? "Editar Aplicação" : "Nova Aplicação"}
                    </h2>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Nome da Meta/Aplicação</label>
                            <div className="relative">
                                <Target className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Ex: Tesouro Direto - Viagem"
                                    className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    {...register("goalName", { required: true })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Valor Investido</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
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
                                    className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    {...register("date", { required: true })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Rendimento Estimado ao Mês (%)</label>
                            <div className="relative">
                                <TrendingUp className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="Ex: 0.85"
                                    className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    {...register("yieldRate")}
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                            <input
                                type="checkbox"
                                id="isAutoCorrecting"
                                className="w-5 h-5 rounded border-border text-primary focus:ring-primary/50"
                                {...register("isAutoCorrecting")}
                            />
                            <label htmlFor="isAutoCorrecting" className="text-sm font-medium text-foreground cursor-pointer">
                                Correção Automática (Juros Compostos)
                            </label>
                        </div>

                        <div className="flex gap-2 mt-4">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex-1 bg-primary text-primary-foreground font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-70"
                            >
                                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : editingId ? "Atualizar" : <><TrendingUp className="w-5 h-5" /> Registrar</>}
                            </button>
                            {editingId && (
                                <button
                                    type="button"
                                    onClick={cancelEdit}
                                    className="px-4 bg-muted text-muted-foreground hover:text-foreground font-semibold rounded-lg flex items-center justify-center hover:bg-muted/80 transition-all border border-border"
                                >
                                    Cancelar
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* List of Investments/Goals */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col">
                        <h2 className="text-xl font-bold mb-4">Minhas Metas</h2>

                        <div className="space-y-4">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-10">
                                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                                </div>
                            ) : investments.length === 0 ? (
                                <div className="text-center py-10 text-muted-foreground">
                                    <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p>Nenhuma aplicação registrada ainda.</p>
                                </div>
                            ) : (
                                investments.map((inv) => (
                                    <div key={inv.id} className="p-4 bg-background border border-border rounded-xl hover:border-primary/30 transition-colors group">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-primary/10 p-2 rounded-full text-primary">
                                                    <Target className="w-5 h-5" />
                                                </div>
                                                <h3 className="font-semibold text-foreground text-lg">{inv.goalName}</h3>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-primary">R$ {Number(inv.value).toFixed(2).replace('.', ',')}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    Aplicado em {new Date(inv.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                                </p>
                                                <div className="mt-1 flex flex-col items-end gap-1">
                                                    {inv.yieldRate !== undefined && inv.yieldRate !== null && inv.yieldRate > 0 && (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-muted text-foreground">
                                                            Rende {inv.yieldRate}% am
                                                        </span>
                                                    )}
                                                    {inv.isAutoCorrecting && (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary">
                                                            Correção Automática Ativa
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-4">
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="text-muted-foreground font-medium">Progresso ({inv.progress}%)</span>
                                                <span className="text-muted-foreground font-medium">Meta: R$ {Number(inv.target).toFixed(2).replace('.', ',')}</span>
                                            </div>
                                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden mb-3">
                                                <div
                                                    className="h-full bg-primary rounded-full"
                                                    style={{ width: `${Math.min(inv.progress, 100)}%` }}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex justify-end gap-2 pt-2 mt-2 border-t border-border/50">
                                            <button onClick={() => editInvestment(inv)} className="text-sm px-3 py-1.5 flex items-center gap-1.5 text-muted-foreground hover:text-primary bg-muted/50 hover:bg-muted rounded-md transition-colors" title="Editar">
                                                <Edit2 className="w-4 h-4" /> Editar
                                            </button>
                                            <button onClick={() => deleteInvestment(inv.id)} className="text-sm px-3 py-1.5 flex items-center gap-1.5 text-muted-foreground hover:text-destructive bg-muted/50 hover:bg-muted rounded-md transition-colors" title="Excluir Lançamento">
                                                <Trash2 className="w-4 h-4" /> Excluir
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
