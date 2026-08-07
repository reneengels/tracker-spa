import { createRoot } from 'react-dom/client';
import { BrowserRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import './index.css';
import App from './App.tsx';
import { StrictMode } from "react";
import './i18n.tsx';
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <BrowserRouter>
                    <Toaster />
                    <App/>
                </BrowserRouter>
            </AuthProvider>
        </QueryClientProvider>
    </StrictMode>
);
