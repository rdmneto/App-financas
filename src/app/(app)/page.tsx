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
    BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, AreaChart, Area
} from "recharts";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import { useEffect } from "react";


// Different mock data sets based on filter
// Static base structure for chart variables
type TimeFilter = "semana" | "mes" | "ano";

export default function DashboardPage() {
    const [isMounted, setIsMounted] = useState(false);
    const [filter, setFilter] = useState<TimeFilter>("mes");
    const [offset, setOffset] = useState(0); // 0 = current, -1 = previous, +1 = next...
    const [isLoading, setIsLoading] = useState(true);
    const [historyData, setHistoryData] = useState<{ name: string; balance: number; incomes: number; expenses: number; investments: number }[]>([]);
    const [timeLabel, setTimeLabel] = useState("");
    const supabase = createClient();

    // Data State Variables
    const [globalCurrentBalance, setGlobalCurrentBalance] = useState(0);
    const [periodBalance, setPeriodBalance] = useState(0);
    const [totalIncomes, setTotalIncomes] = useState(0);
    const [totalExpenses, setTotalExpenses] = useState(0);
    const [totalInvestments, setTotalInvestments] = useState(0);

    // Top Expenses State
    const [topExpenses, setTopExpenses] = useState<{ description: string, value: number }[]>([]);
    const [detailedExpenses, setDetailedExpenses] = useState<{ name: string, value: number }[]>([]);

    // Expenses Pie Chart States
    const [essentialsSum, setEssentialsSum] = useState(0);
    const [lifestyleSum, setLifestyleSum] = useState(0);
    const [savingsSum, setSavingsSum] = useState(0);

    useEffect(() => {
        setIsMounted(true);
    }, []);

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

            // Use YYYY-MM-DD format to avoid UTC timezone shift issues
            const pad = (n: number) => String(n).padStart(2, '0');
            const startDateStr = `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}`;
            const endDateStr = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}`;

            // We need to fetch ALL past/present incomes and expenses up to TODAY to calculate the Global Current Balance accurately,
            // taking into account all recurrences up to today.
            const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

            const [incomesRes, expensesRes, investmentsRes, globalIncomesRes, globalExpensesRes] = await Promise.all([
                supabase.from('incomes').select('*').gte('date', startDateStr).lte('date', endDateStr),
                supabase.from('expenses').select('*').gte('date', startDateStr).lte('date', endDateStr),
                supabase.from('investments').select('*').gte('date', startDateStr).lte('date', endDateStr),
                supabase.from('incomes').select('*').lte('date', todayStr),
                supabase.from('expenses').select('*').lte('date', todayStr)
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

                        // Use the chart's 'endDate' to allow viewing future months properly
                        let endLimit = new Date(endDate.getFullYear(), endDate.getMonth(), loopDate.getDate());
                        if (e.recurrence_end_date) {
                            const [ey, em, ed] = e.recurrence_end_date.split('-');
                            const cancelDate = new Date(Number(ey), Number(em) - 1, Number(ed.split('T')[0]));
                            if (cancelDate < endLimit) {
                                endLimit = cancelDate;
                            }
                        }

                        let currentInstallment = 2;
                        const maxInstallments = e.installments || 0;

                        while (
                            (loopDate.getFullYear() < endLimit.getFullYear()) ||
                            (loopDate.getFullYear() === endLimit.getFullYear() && loopDate.getMonth() <= endLimit.getMonth())
                        ) {
                            if (e.recurrence_end_date) {
                                const [cy, cm, cd] = e.recurrence_end_date.split('-');
                                const cancelDate = new Date(Number(cy), Number(cm) - 1, Number(cd.split('T')[0]));
                                if (loopDate > cancelDate) break;
                            }
                            if (maxInstallments > 0 && currentInstallment > maxInstallments) break;

                            // Construct a localized YYYY-MM-DD string to match Supabase's format
                            const vYear = loopDate.getFullYear();
                            const vMonth = String(loopDate.getMonth() + 1).padStart(2, '0');
                            const vDay = String(loopDate.getDate()).padStart(2, '0');
                            const virtualDateStr = `${vYear}-${vMonth}-${vDay}T00:00:00`;

                            // Push any virtual clones up to the chart's endDate.
                            // Partitions between 'past' and 'current' bins happen after this loop returns.
                            if (loopDate <= endDate) {
                                processed.push({ ...e, date: virtualDateStr });
                            }

                            loopDate.setMonth(loopDate.getMonth() + 1);
                            currentInstallment++;
                        }
                    }
                });
                return processed;
            };

            const processedExpensesData = expensesRes.data ? processExpenses(expensesRes.data, false) : [];
            const processedGlobalExpensesData = globalExpensesRes.data ? processExpenses(globalExpensesRes.data, true) : [];


            // For the current period (offset=0), filter out expenses with dates after today
            // so that virtual recurring charges for future months don't inflate the totals.
            const today = new Date();
            today.setHours(23, 59, 59, 999);
            const expensesForTotals = processedExpensesData.filter(e => {
                const [year, month, day] = e.date.split('-');
                const eDate = new Date(Number(year), Number(month) - 1, Number(day.split('T')[0]));
                return eDate >= startDate && eDate <= endDate; // Only exact period matches
            });

            // For Top Expenses List (Individual Transactions)
            const sortedExpenses = [...expensesForTotals].sort((a, b) => b.value - a.value).slice(0, 5);
            setTopExpenses(sortedExpenses.map(e => ({ description: e.description, value: e.value })));

            // Aggregate by Description for Detailed Chart
            const expensesByDesc: Record<string, number> = {};
            expensesForTotals.forEach(e => {
                // simple normalization to group similar items
                const desc = e.description.trim().toUpperCase();
                expensesByDesc[desc] = (expensesByDesc[desc] || 0) + e.value;
            });

            const groupedDetailedExpenses = Object.entries(expensesByDesc)
                .map(([desc, val]) => ({
                    // Capitalize first letter of each word to make it look nice
                    name: desc.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '),
                    value: val
                }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 8); // Top 8 descriptions
            setDetailedExpenses(groupedDetailedExpenses);

            expensesForTotals.forEach(e => {
                eSum += e.value;
                if (e.category_type === 'Essenciais') essSum += e.value;
                else if (e.category_type === 'Estilo de Vida') lifeSum += e.value;
                else if (e.category_type === 'Poupança') savSum += e.value;
                else if (e.category_type.includes('Poupança')) savSum += e.value;
            });

            let invSum = 0;
            if (investmentsRes.data) invSum = investmentsRes.data.reduce((acc, curr) => acc + curr.value, 0);

            let globalIncomesSum = 0;
            if (globalIncomesRes.data) globalIncomesSum = globalIncomesRes.data.reduce((acc, curr) => acc + curr.value, 0);

            let globalExpensesSum = 0;
            processedGlobalExpensesData.forEach(e => {
                const [year, month, day] = e.date.split('-');
                const eDate = new Date(Number(year), Number(month) - 1, Number(day.split('T')[0]));
                if (eDate <= today) {
                    globalExpensesSum += e.value;
                }
            });

            setGlobalCurrentBalance(globalIncomesSum - globalExpensesSum);
            setPeriodBalance(iSum - eSum);
            setTotalIncomes(iSum);
            setTotalExpenses(eSum);
            setTotalInvestments(invSum);

            setEssentialsSum(essSum);
            setLifestyleSum(lifeSum);
            setSavingsSum(savSum);

            // Calculate past balance to offset the chart (balance before startDate)
            let chartPreviousIncomes = 0;
            let chartPreviousExpenses = 0;
            if (globalIncomesRes.data) {
                globalIncomesRes.data.forEach(inc => {
                    const [year, month, day] = inc.date.split('-');
                    const eqDate = new Date(Number(year), Number(month) - 1, Number(day.split('T')[0]));
                    if (eqDate < startDate) chartPreviousIncomes += inc.value;
                });
            }
            if (processedGlobalExpensesData) {
                processedGlobalExpensesData.forEach(exp => {
                    const [year, month, day] = exp.date.split('-');
                    const eqDate = new Date(Number(year), Number(month) - 1, Number(day.split('T')[0]));
                    if (eqDate < startDate) chartPreviousExpenses += exp.value;
                });
            }
            const initialChartBalance = chartPreviousIncomes - chartPreviousExpenses;

            // Build Data History Bins for the Dashboard Chart
            let bins: { name: string; balance: number; incomes: number; expenses: number; investments: number }[] = [];
            let label = "";
            let startOfPeriod = new Date(startDate.getTime()); // copy local startDate for labels

            if (filter === "semana") {
                const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
                bins = days.map((name) => ({ name, balance: 0, incomes: 0, expenses: 0, investments: 0 }));
                label = `Semana de ${startOfPeriod.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`;
            } else if (filter === "mes") {
                const daysInMonth = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0).getDate();
                bins = Array.from({ length: daysInMonth }, (_, i) => ({ name: (i + 1).toString(), balance: 0, incomes: 0, expenses: 0, investments: 0 }));
                label = startOfPeriod.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                label = label.charAt(0).toUpperCase() + label.slice(1);
            } else {
                const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
                bins = months.map((name) => ({ name, balance: 0, incomes: 0, expenses: 0, investments: 0 }));
                label = `Ano ${startOfPeriod.getFullYear()}`;
            }

            const incomesData = incomesRes.data || [];

            // Group transactions precisely into chart bins chronologically avoiding external timezone shifts
            incomesData.forEach(income => {
                const [year, month, day] = income.date.split('-');
                const d = new Date(Number(year), Number(month) - 1, Number(day.split('T')[0]));
                if (filter === "semana") { bins[d.getDay()].balance += income.value; bins[d.getDay()].incomes += income.value; }
                if (filter === "mes") { bins[d.getDate() - 1].balance += income.value; bins[d.getDate() - 1].incomes += income.value; }
                if (filter === "ano") { bins[d.getMonth()].balance += income.value; bins[d.getMonth()].incomes += income.value; }
            });

            processedExpensesData.forEach(expense => {
                const [year, month, day] = expense.date.split('-');
                const d = new Date(Number(year), Number(month) - 1, Number(day.split('T')[0]));
                if (filter === "semana") { bins[d.getDay()].balance -= expense.value; bins[d.getDay()].expenses += expense.value; }
                if (filter === "mes") { bins[d.getDate() - 1].balance -= expense.value; bins[d.getDate() - 1].expenses += expense.value; }
                if (filter === "ano") { bins[d.getMonth()].balance -= expense.value; bins[d.getMonth()].expenses += expense.value; }
            });

            const investmentsData = investmentsRes.data || [];
            investmentsData.forEach(inv => {
                const [year, month, day] = inv.date.split('-');
                const d = new Date(Number(year), Number(month) - 1, Number(day.split('T')[0]));
                if (filter === "semana") bins[d.getDay()].investments += inv.value;
                if (filter === "mes") bins[d.getDate() - 1].investments += inv.value;
                if (filter === "ano") bins[d.getMonth()].investments += inv.value;
            });

            // Make it cumulative to behave like true Evolution scale graph
            let runningBalance = initialChartBalance;

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

    const formatBRL = (val: number) => `R$ ${val.toFixed(2).replace('.', ',')}`;

    const summaryData = [
        { label: "Saldo Atual", value: formatBRL(globalCurrentBalance), icon: Wallet, color: "text-primary", bg: "bg-primary/10" },
        { label: "Saldo do Período", value: formatBRL(periodBalance), icon: Wallet, color: periodBalance >= 0 ? "text-success" : "text-destructive", bg: periodBalance >= 0 ? "bg-success/10" : "bg-destructive/10" },
        { label: "Receitas", value: formatBRL(totalIncomes), icon: ArrowDownCircle, color: "text-success", bg: "bg-success/10" },
        { label: "Despesas", value: formatBRL(totalExpenses), icon: ArrowUpCircle, color: "text-destructive", bg: "bg-destructive/10" },
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

    if (!isMounted) {
        return <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto opacity-0" />;
    }

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

                {/* Balance History Line Chart */}
                <div className={cn("lg:col-span-2 bg-card border border-border rounded-xl p-6 shadow-sm", isLoading && "opacity-50 pointer-events-none")}>
                    <h2 className="text-lg font-bold mb-4">Fluxo de Caixa (Receitas vs Despesas)</h2>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={historyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorIncomes" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--success)" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--destructive)" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="var(--destructive)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)' }} tickFormatter={yAxisFormatter} width={80} />
                                <RechartsTooltip
                                    cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1, strokeDasharray: '3 3' }}
                                    contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }}
                                    formatter={(value: any, name: string | undefined) => {
                                        const formattedValue = `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;
                                        const labels: Record<string, string> = { incomes: "Receitas", expenses: "Despesas" };
                                        return [formattedValue, labels[name || ""] || name];
                                    }}
                                />
                                <Area type="monotone" dataKey="incomes" name="incomes" stroke="var(--success)" strokeWidth={3} fillOpacity={1} fill="url(#colorIncomes)" />
                                <Area type="monotone" dataKey="expenses" name="expenses" stroke="var(--destructive)" strokeWidth={3} fillOpacity={1} fill="url(#colorExpenses)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Expenses Pie Chart */}
                <div className={cn("lg:col-span-1 bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col items-center", isLoading && "opacity-50 pointer-events-none")}>
                    <h2 className="text-lg font-bold mb-4 self-start">Despesas por Categoria</h2>
                    {essentialsSum > 0 || lifestyleSum > 0 || savingsSum > 0 ? (
                        <>
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
                                        <RechartsTooltip formatter={(val: any) => `R$ ${Number(val || 0).toFixed(2).replace('.', ',')}`} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="space-y-3 mt-4 w-full">
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
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                            Nenhuma despesa no período.
                        </div>
                    )}
                </div>

                {/* Detailed Expenses Bar Chart */}
                <div className={cn("lg:col-span-2 bg-card border border-border rounded-xl p-6 shadow-sm", isLoading && "opacity-50 pointer-events-none")}>
                    <h2 className="text-lg font-bold mb-4">Despesas Detalhadas (Top 8)</h2>
                    {detailedExpenses.length > 0 ? (
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart layout="vertical" data={detailedExpenses} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border)" />
                                    <XAxis type="number" hide />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: 'var(--foreground)', fontSize: 13 }}
                                        width={140}
                                    />
                                    <RechartsTooltip
                                        cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                                        contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }}
                                        formatter={(val: any) => [`R$ ${Number(val || 0).toFixed(2).replace('.', ',')}`, "Total Gasto"]}
                                    />
                                    <Bar dataKey="value" fill="var(--destructive)" radius={[0, 4, 4, 0]} maxBarSize={30}>
                                        {detailedExpenses.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fillOpacity={1 - (index * 0.08)} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm h-[300px]">
                            Nenhuma despesa para detalhar.
                        </div>
                    )}
                </div>

                {/* Top Expenses List */}
                <div className={cn("lg:col-span-1 bg-card border border-border rounded-xl p-6 shadow-sm", isLoading && "opacity-50 pointer-events-none")}>
                    <h2 className="text-lg font-bold mb-4">Maiores Despesas do Período</h2>
                    {topExpenses.length > 0 ? (
                        <div className="space-y-4">
                            {topExpenses.map((expense, i) => (
                                <div key={i} className="flex justify-between items-center border-b border-border pb-3 last:border-0 last:pb-0">
                                    <span className="text-sm font-medium text-foreground truncate max-w-[180px]" title={expense.description}>
                                        {expense.description}
                                    </span>
                                    <span className="text-sm text-destructive font-semibold">
                                        -{formatBRL(expense.value)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm h-32">
                            Nenhuma despesa no período.
                        </div>
                    )}
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
                                    formatter={(value: any, name: string | undefined) => {
                                        const formattedValue = `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;
                                        const safeName = name || "";
                                        const labels: Record<string, string> = {
                                            balance: "Evolução (Saldo)",
                                            incomes: "Receitas",
                                            expenses: "Despesas",
                                            investments: "Aplicações"
                                        };
                                        return [formattedValue, labels[safeName] || safeName];
                                    }}
                                />
                                <Bar dataKey="balance" name="balance" fill="#eab308" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                <Bar dataKey="investments" name="investments" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
