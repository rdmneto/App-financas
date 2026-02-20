"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Mail, Lock, ArrowRight, Activity } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type AuthMode = "login" | "register";

export default function AuthPage() {
    const [mode, setMode] = useState<AuthMode>("login");
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const { register, handleSubmit, formState: { errors } } = useForm();

    // Aggressively destroy any existing session cookie when visiting login
    // This supports the user's strict requirement to always force a fresh login when starting the app
    useEffect(() => {
        // Destroy mock cookies just in case they persist
        document.cookie = "sb-auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";

        // Destroy real supabase session
        const supabase = createClient();
        supabase.auth.signOut();
    }, []);

    const onSubmit = async (data: any) => {
        setIsLoading(true);
        const supabase = createClient();
        try {
            if (mode === "register") {
                const { error } = await supabase.auth.signUp({
                    email: data.email,
                    password: data.password,
                    options: {
                        data: {
                            full_name: data.name,
                        }
                    }
                });

                if (error) throw error;

                alert("Cadastro realizado! Por favor, faça login.");
                setMode("login");
                setIsLoading(false);
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email: data.email,
                    password: data.password,
                });

                if (error) throw error;

                // Redirect to dashboard on logic success
                router.push("/");
            }
        } catch (error: any) {
            alert(error.message || "Ocorreu um erro na autenticação.");
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-sm">
            <div className="flex justify-center mb-6">
                <div className="bg-primary/10 text-primary p-3 rounded-full flex items-center justify-center">
                    <Activity className="w-8 h-8 font-bold" />
                </div>
            </div>

            <h1 className="text-2xl font-bold text-center mb-1 text-foreground">
                {mode === "login" ? "Bem-vindo de volta" : "Crie sua conta"}
            </h1>
            <p className="text-muted-foreground text-center mb-8">
                {mode === "login"
                    ? "Entre para gerenciar suas finanças."
                    : "Comece a organizar seu dinheiro hoje mesmo."}
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {mode === "register" && (
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Nome completo</label>
                        <div className="relative">
                            <UserIcon className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="João Silva"
                                className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                {...register("name", { required: mode === "register" })}
                            />
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">E-mail</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                        <input
                            type="email"
                            placeholder="seu@email.com"
                            className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                            {...register("email", { required: true })}
                        />
                    </div>
                    {errors.email && <span className="text-xs text-destructive">E-mail é obrigatório</span>}
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Senha</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                        <input
                            type="password"
                            placeholder="••••••••"
                            className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                            {...register("password", { required: true, minLength: 6 })}
                        />
                    </div>
                    {errors.password && <span className="text-xs text-destructive">A senha deve ter pelo menos 6 caracteres</span>}
                </div>

                {mode === "login" && (
                    <div className="flex justify-end">
                        <button type="button" className="text-sm text-primary hover:underline">
                            Esqueci minha senha
                        </button>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-lg flex justify-center items-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-70 mt-4"
                >
                    {isLoading ? (
                        <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <>
                            {mode === "login" ? "Entrar" : "Criar conta"}
                            <ArrowRight className="w-5 h-5" />
                        </>
                    )}
                </button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
                {mode === "login" ? (
                    <>
                        Não tem uma conta?{" "}
                        <button
                            type="button"
                            onClick={() => setMode("register")}
                            className="text-primary font-medium hover:underline"
                        >
                            Cadastre-se
                        </button>
                    </>
                ) : (
                    <>
                        Já tem uma conta?{" "}
                        <button
                            type="button"
                            onClick={() => setMode("login")}
                            className="text-primary font-medium hover:underline"
                        >
                            Faça login
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

function UserIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx={12} cy={7} r={4} />
        </svg>
    );
}
