import { createRoot } from 'react-dom/client';
import { BrowserRouter } from "react-router";
import './index.css';
import App from './App.tsx';
import { StrictMode } from "react";
import './i18n.tsx';
import { Toaster } from "sonner";

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <BrowserRouter>
            <Toaster />
            <App/>
        </BrowserRouter>
    </StrictMode>
);
