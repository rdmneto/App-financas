"use client";

import { useState } from "react";
import {
    ArrowDownCircle,
    ArrowUpCircle,
    Wallet,
    TrendingUp,
    SlidersHorizontal,
    ChevronLeft,
    ChevronRight
} from "lucide-react";
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import { useEffect } from "react";


// Different mock data sets based on filter
// Static base structure for chart variables
type TimeFilter = "semana" | "mes" | "ano";

export default function DashboardPage() {
    const [filter, setFilter] = useState<TimeFilter>("mes");
    const [offset, setOffset] = useState(0); // 0 = current, -1 = previous, +1 = next...
    const [isLoading, setIsLoading] = useState(true);
    const [historyData, setHistoryData] = useState<{ name: string; balance: number }[]>([]);
    const [timeLabel, setTimeLabel] = useState("");
    const supabase = createClient();

    // Data State Variables
    const [totalIncomes, setTotalIncomes] = useState(0);
    const [totalExpenses, setTotalExpenses] = useState(0);
    const [totalInvestments, setTotalInvestments] = useState(0);
    const [previousBalance, setPreviousBalance] = useState(0);

    // Expenses Pie Chart States
    const [essentialsSum, setEssentialsSum] = useState(0);
    const [lifestyleSum, setLifestyleSum] = useState(0);
    const [savingsSum, setSavingsSum] = useState(0);

    useEffect(() => {
        async function fetchDashboardData() {
            setIsLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            let startDate: Date;
            let endDate: Date;
            const now = new Date();

            if (filter === "semana") {
                // start of current week (Sunday) + offset weeks
                startDate = new Date(now.setDate(now.getDate() - now.getDay() + (offset * 7)));
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6);
                endDate.setHours(23, 59, 59, 999);
            } else if (filter === "mes") {
                startDate = new Date(now.getFullYear(), now.getMonth() + offset, 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
                endDate.setHours(23, 59, 59, 999);
            } else {
                // ano
                startDate = new Date(now.getFullYear() + offset, 0, 1);
                endDate = new Date(now.getFullYear() + offset, 11, 31);
                endDate.setHours(23, 59, 59, 999);
            }

            const startDateStr = startDate.toISOString();
            const endDateStr = endDate.toISOString();

            const [incomesRes, expensesRes, investmentsRes, pastIncomesRes, pastExpensesRes] = await Promise.all([
                supabase.from('incomes').select('value, date').gte('date', startDateStr).lte('date', endDateStr),
                supabase.from('expenses').select('value, category_type, date, is_recurring, recurrence_end_date').gte('date', startDateStr).lte('date', endDateStr),
                supabase.from('investments').select('value, date').gte('date', startDateStr).lte('date', endDateStr),
                supabase.from('incomes').select('value').lt('date', startDateStr),
                supabase.from('expenses').select('value, category_type, date, is_recurring, recurrence_end_date').lt('date', startDateStr)
            ]);

            let iSum = 0;
            if (incomesRes.data) iSum = incomesRes.data.reduce((acc, curr) => acc + curr.value, 0);

            let eSum = 0;
            let essSum = 0;
            let lifeSum = 0;
            let savSum = 0;

            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth();

            // Helper to generate virtuals for a given expense list
            const processExpenses = (expenseList: any[], isPastList: boolean) => {
                let processed: any[] = [];
                expenseList.forEach(e => {
                    // Always add the original if it belongs to this list's timeframe
                    processed.push(e);

                    if (e.is_recurring) {
                        const [yearStr, monthStr, dayStr] = e.date.split('-');
                        let loopDate = new Date(Number(yearStr), Number(monthStr) - 1, Number(dayStr.split('T')[0]));
                        loopDate.setMonth(loopDate.getMonth() + 1);

                        let endLimit = new Date(currentYear, currentMonth, loopDate.getDate());
                        if (e.recurrence_end_date) {
                            const [ey, em, ed] = e.recurrence_end_date.split('-');
                            const cancelDate = new Date(Number(ey), Number(em) - 1, Number(ed.split('T')[0]));
                            if (cancelDate < endLimit) {
                                endLimit = cancelDate;
                            }
                        }

                        while (
                            (loopDate.getFullYear() < endLimit.getFullYear()) ||
                            (loopDate.getFullYear() === endLimit.getFullYear() && loopDate.getMonth() <= endLimit.getMonth())
                        ) {
                            if (e.recurrence_end_date) {
                                const cancelDate = new Date(e.recurrence_end_date);
                                if (loopDate > cancelDate) break;
                            }
                            if (loopDate > now) break;

                            // Date boundary check for whether this virtual clone belongs in "past" or "current" bucket
                            if (isPastList) {
                                if (loopDate < startDate) {
                                    processed.push({ ...e, date: loopDate.toISOString() });
                                }
                            } else {
                                if (loopDate >= startDate && loopDate <= endDate) {
                                    processed.push({ ...e, date: loopDate.toISOString() });
                                }
                            }

                            loopDate.setMonth(loopDate.getMonth() + 1);
                        }
                    }
                });
                return processed;
            };

            const processedExpensesData = expensesRes.data ? processExpenses(expensesRes.data, false) : [];
            const processedPastExpensesData = pastExpensesRes.data ? processExpenses(pastExpensesRes.data, true) : [];

            // Some past expenses might generate virtuals that fall into the CURRENT time window!
            // We need to move those from processedPastExpensesData to processedExpensesData
            const finalPastExpenses: any[] = [];
            processedPastExpensesData.forEach(e => {
                const eDate = new Date(e.date);
                if (eDate >= startDate && eDate <= endDate) {
                    processedExpensesData.push(e);
                } else if (eDate < startDate) {
                    finalPastExpenses.push(e);
                }
            });


            processedExpensesData.forEach(e => {
                eSum += e.value;
                if (e.category_type === 'Essenciais') essSum += e.value;
                else if (e.category_type === 'Estilo de Vida') lifeSum += e.value;
                else if (e.category_type === 'Poupança') savSum += e.value;
                // Note: If using the old name 'Poupança/Dívidas' it falls into the last bucket
                else if (e.category_type.includes('Poupança')) savSum += e.value;
            });

            let invSum = 0;
            if (investmentsRes.data) invSum = investmentsRes.data.reduce((acc, curr) => acc + curr.value, 0);

            let pastIncomesSum = 0;
            if (pastIncomesRes.data) pastIncomesSum = pastIncomesRes.data.reduce((acc, curr) => acc + curr.value, 0);

            let pastExpensesSum = 0;
            finalPastExpenses.forEach(e => {
                pastExpensesSum += e.value;
            });

            const initialBalance = pastIncomesSum - pastExpensesSum;
            setPreviousBalance(initialBalance);

            setTotalIncomes(iSum);
            setTotalExpenses(eSum);
            setTotalInvestments(invSum);

            setEssentialsSum(essSum);
            setLifestyleSum(lifeSum);
            setSavingsSum(savSum);

            // Build Data History Bins for the Dashboard Chart
            let bins: { name: string; balance: number }[] = [];
            let label = "";
            let startOfPeriod = new Date(startDateStr);
            startOfPeriod.setTime(startOfPeriod.getTime() + startOfPeriod.getTimezoneOffset() * 60000); // adjust pseudo UTC to local for labels

            if (filter === "semana") {
                const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
                bins = days.map((name) => ({ name, balance: 0 }));
                label = `Semana de ${startOfPeriod.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`;
            } else if (filter === "mes") {
                const daysInMonth = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0).getDate();
                bins = Array.from({ length: daysInMonth }, (_, i) => ({ name: (i + 1).toString(), balance: 0 }));
                label = startOfPeriod.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                label = label.charAt(0).toUpperCase() + label.slice(1);
            } else {
                const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
                bins = months.map((name) => ({ name, balance: 0 }));
                label = `Ano ${startOfPeriod.getFullYear()}`;
            }

            const incomesData = incomesRes.data || [];

            // Group transactions precisely into chart bins chronologically avoiding external timezone shifts
            incomesData.forEach(income => {
                const [year, month, day] = income.date.split('-');
                const d = new Date(Number(year), Number(month) - 1, Number(day.split('T')[0]));
                if (filter === "semana") bins[d.getDay()].balance += income.value;
                if (filter === "mes") bins[d.getDate() - 1].balance += income.value;
                if (filter === "ano") bins[d.getMonth()].balance += income.value;
            });

            processedExpensesData.forEach(expense => {
                const [year, month, day] = expense.date.split('-');
                const d = new Date(Number(year), Number(month) - 1, Number(day.split('T')[0]));
                if (filter === "semana") bins[d.getDay()].balance -= expense.value;
                if (filter === "mes") bins[d.getDate() - 1].balance -= expense.value;
                if (filter === "ano") bins[d.getMonth()].balance -= expense.value;
            });

            // Make it cumulative to behave like true Evolution scale graph
            let runningBalance = initialBalance;

            const currentDayIndex = now.getDay();
            const currentDateIndex = now.getDate() - 1;
            const currentMonthIndex = now.getMonth();

            // Filter out bins that represent future unreached periods
            let finalBins = bins;
            if (offset >= 0) {
                finalBins = bins.filter((bin, index) => {
                    if (offset > 0) return false; // Future periods have no past to build upon
                    if (filter === "semana" && index > currentDayIndex) return false;
                    if (filter === "mes" && index > currentDateIndex) return false;
                    if (filter === "ano" && index > currentMonthIndex) return false;
                    return true;
                });
            }

            finalBins.forEach(bin => {
                runningBalance += bin.balance;
                bin.balance = runningBalance;
            });

            setHistoryData(finalBins);
            setTimeLabel(label);

            setIsLoading(false);
        }

        fetchDashboardData();
    }, [filter, offset]); // re-fetch / re-aggregate when filter or offset changes

    // Compute dynamic dashboard structure
    const currentBalance = previousBalance + totalIncomes - totalExpenses;
    const formatBRL = (val: number) => `R$ ${val.toFixed(2).replace('.', ',')}`;

    const summaryData = [
        { label: "Saldo Atual", value: formatBRL(currentBalance), icon: Wallet, color: "text-primary", bg: "bg-primary/10" },
        { label: "Receitas", value: formatBRL(totalIncomes), icon: ArrowDownCircle, color: "text-success", bg: "bg-success/10" },
        { label: "Despesas", value: formatBRL(totalExpenses), icon: ArrowUpCircle, color: "text-destructive", bg: "bg-destructive/10" },
        { label: "Aplicações", value: formatBRL(totalInvestments), icon: TrendingUp, color: "text-blue-500", bg: "bg-blue-500/10" },
    ];

    const pieData = [
        { name: "Essenciais", value: essentialsSum, color: "var(--chart-essential)" },
        { name: "Estilo de Vida", value: lifestyleSum, color: "var(--chart-lifestyle)" },
        { name: "Poupança", value: savingsSum, color: "var(--chart-savings)" },
    ];

    const yAxisFormatter = (value: number) => {
        if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)}k`;
        return `R$ ${value}`;
    };

    return (
        <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
            {/* Header & Filters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Visão Geral</h1>
                    <p className="text-muted-foreground mt-1">Acompanhe seu progresso financeiro</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setOffset(o => o - 1)} className="p-1 hover:bg-muted rounded-md transition-colors">
                            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
                        </button>
                        <span className="text-sm font-medium w-32 text-center">{timeLabel}</span>
                        <button onClick={() => setOffset(o => o + 1)} className="p-1 hover:bg-muted rounded-md transition-colors">
                            <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        </button>
                    </div>

                    <div className="flex items-center gap-2 bg-card border border-border rounded-lg p-1">
                        <button
                            onClick={() => { setFilter("semana"); setOffset(0); }}
                            className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-colors", filter === "semana" && "bg-muted text-foreground")}
                        >
                            Semana
                        </button>
                        <button
                            onClick={() => { setFilter("mes"); setOffset(0); }}
                            className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-colors", filter === "mes" && "bg-muted text-foreground")}
                        >
                            Mês
                        </button>
                        <button
                            onClick={() => { setFilter("ano"); setOffset(0); }}
                            className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-colors", filter === "ano" && "bg-muted text-foreground")}
                        >
                            Ano
                        </button>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4", isLoading && "opacity-50 pointer-events-none")}>
                {summaryData.map((item, i) => (
                    <div key={i} className="bg-card border border-border rounded-xl p-5 shadow-sm flex items-center gap-4">
                        <div className={cn("w-12 h-12 rounded-full flex items-center justify-center", item.bg)}>
                            <item.icon className={cn("w-6 h-6", item.color)} />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground font-medium">{item.label}</p>
                            <p className="text-2xl font-bold mt-0.5">{item.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Expenses Pie Chart */}
                <div className={cn("lg:col-span-1 bg-card border border-border rounded-xl p-6 shadow-sm", isLoading && "opacity-50 pointer-events-none")}>
                    <h2 className="text-lg font-bold mb-4">Despesas por Categoria</h2>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <RechartsTooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="space-y-3 mt-4">
                        {pieData.map((entry, i) => (
                            <div key={i} className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                                    <span className="text-foreground">{entry.name}</span>
                                </div>
                                <span className="font-medium text-muted-foreground">
                                    R$ {entry.value.toFixed(2).replace('.', ',')}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Balance History Bar Chart */}
                <div className={cn("lg:col-span-2 bg-card border border-border rounded-xl p-6 shadow-sm", isLoading && "opacity-50 pointer-events-none")}>
                    <h2 className="text-lg font-bold mb-4">Evolução do Patrimônio</h2>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={historyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)' }} tickFormatter={yAxisFormatter} width={80} />
                                <RechartsTooltip
                                    cursor={{ fill: 'var(--muted)' }}
                                    contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }}
                                    formatter={(value: any) => [`R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`, "Saldo"]}
                                />
                                <Bar dataKey="balance" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={50} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
