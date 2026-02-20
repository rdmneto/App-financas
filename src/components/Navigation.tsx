"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    ArrowDownCircle,
    ArrowUpCircle,
    TrendingUp,
    User,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/incomes", label: "Receitas", icon: ArrowDownCircle },
    { href: "/expenses", label: "Despesas", icon: ArrowUpCircle },
    { href: "/investments", label: "Aplicações", icon: TrendingUp },
    { href: "/profile", label: "Perfil", icon: User },
];

export function Navigation() {
    const pathname = usePathname();

    return (
        <>
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex flex-col w-64 h-screen border-r bg-card border-border sticky top-0">
                <div className="p-6 font-bold text-2xl text-primary flex items-center gap-2">
                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
                        $
                    </div>
                    Finanças
                </div>
                <nav className="flex-1 px-4 py-8 space-y-2">
                    {NAV_ITEMS.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium",
                                    isActive
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <item.icon className={cn("w-5 h-5", isActive && "text-primary")} />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
            </aside>

            {/* Mobile Bottom Navigation */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-card border-border z-50">
                <div className="flex items-center justify-around p-3 pb-safe">
                    {NAV_ITEMS.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex flex-col items-center gap-1 p-2 transition-all rounded-lg",
                                    isActive
                                        ? "text-primary"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <div
                                    className={cn(
                                        "p-1.5 rounded-full",
                                        isActive && "bg-primary/10"
                                    )}
                                >
                                    <item.icon className="w-5 h-5" />
                                </div>
                                <span className="text-[10px] font-medium">{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </>
    );
}
