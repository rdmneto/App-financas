"use client";

import { User, Settings, LogOut, Bell, Shield } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";

export default function ProfilePage() {
    const router = useRouter();
    const [userName, setUserName] = useState("");
    const [userEmail, setUserEmail] = useState("");

    useEffect(() => {
        const fetchUser = async () => {
            const supabase = createClient();
            const { data } = await supabase.auth.getUser();
            if (data.user) {
                setUserEmail(data.user.email || "");
                setUserName(data.user.user_metadata?.full_name || "Usuário");
            }
        };
        fetchUser();
    }, []);

    const handleLogout = async () => {
        // Clear mock cookies aggressively just in case
        document.cookie = "sb-auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";

        // Execute real supabase session destruction
        const supabase = createClient();
        await supabase.auth.signOut();

        router.push("/login");
    };

    return (
        <div className="p-4 md:p-8 space-y-6 max-w-3xl mx-auto">
            <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2.5 rounded-lg text-primary">
                    <User className="w-8 h-8" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold">Meu Perfil</h1>
                    <p className="text-muted-foreground mt-1">Gerencie sua conta e preferências</p>
                </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex items-center gap-6">
                <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center text-primary text-3xl font-bold uppercase">
                    {userName ? userName[0] : "U"}
                </div>
                <div>
                    <h2 className="text-2xl font-bold">{userName || "Carregando..."}</h2>
                    <p className="text-muted-foreground">{userEmail}</p>
                    <div className="mt-2 text-sm bg-primary/10 text-primary px-3 py-1 rounded-full inline-block font-medium">
                        Plano Premium Ativo
                    </div>
                </div>
            </div>

            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                <button
                    onClick={() => alert("Em breve: Ajustar preferências da conta.")}
                    className="w-full text-left p-4 border-b border-border flex items-center gap-3 hover:bg-muted/50 transition-colors"
                >
                    <Settings className="text-muted-foreground" />
                    <span className="font-medium">Configurações da Conta</span>
                </button>
                <button
                    onClick={() => alert("Nenhuma notificação nova no momento.")}
                    className="w-full text-left p-4 border-b border-border flex items-center gap-3 hover:bg-muted/50 transition-colors"
                >
                    <Bell className="text-muted-foreground" />
                    <span className="font-medium">Notificações</span>
                </button>
                <button
                    onClick={() => alert("Suas chaves biométricas estão atualizadas.")}
                    className="w-full text-left p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors"
                >
                    <Shield className="text-muted-foreground" />
                    <span className="font-medium">Privacidade e Segurança</span>
                </button>
            </div>

            <button
                onClick={handleLogout}
                className="w-full bg-destructive/10 text-destructive font-semibold py-3 rounded-xl flex justify-center items-center gap-2 hover:bg-destructive/20 transition-all"
            >
                <LogOut className="w-5 h-5" />
                Sair da Conta
            </button>
        </div>
    );
}
