import { Navigation } from "@/components/Navigation";

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen">
            {/* Desktop Sidebar will render here from Navigation */}
            <Navigation />

            {/* Main Content Area */}
            <main className="flex-1 pb-20 md:pb-0 overflow-x-hidden">
                {children}
            </main>
        </div>
    );
}
