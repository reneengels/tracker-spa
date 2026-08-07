import './App.scss';
import {Routes, Route} from 'react-router';
import {useEffect} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import Home from "./pages/Home.tsx";
import About from "./pages/About.tsx";
import Board from "./pages/Board.tsx";
import ListView from "./pages/ListView.tsx";
import Login from "./pages/Login.tsx";
import TaskDetail from "./pages/TaskDetail.tsx";
import AdminHome from "./pages/admin/AdminHome.tsx";
import AdminUsers from "./pages/admin/AdminUsers.tsx";
import AdminLabels from "./pages/admin/AdminLabels.tsx";
import AdminWipLimits from "./pages/admin/AdminWipLimits.tsx";
import AdminAgentTokens from "./pages/admin/AdminAgentTokens.tsx";
import AdminNotifications from "./pages/admin/AdminNotifications.tsx";
import RequireAuth from "./components/RequireAuth.tsx";
import RequireRole from "./components/RequireRole.tsx";
import {useAuth} from "@/lib/auth";
import {connectRealtime} from "@/lib/realtime";

function RealtimeConnector() {
    const {isAuthenticated} = useAuth();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!isAuthenticated) {
            return;
        }
        return connectRealtime(queryClient);
    }, [isAuthenticated, queryClient]);

    return null;
}

export default function App() {
    return (
        <>
            <RealtimeConnector/>
            <Routes>
                <Route path="/" element={<Home/>}/>
                <Route path="/about" element={<About/>}/>
                <Route path="/login" element={<Login/>}/>
                <Route path="/board" element={<RequireAuth><Board/></RequireAuth>}/>
                <Route path="/list" element={<RequireAuth><ListView/></RequireAuth>}/>
                <Route path="/my-queue" element={<RequireAuth><ListView presetMyQueue/></RequireAuth>}/>
                <Route path="/tasks/:taskId" element={<RequireAuth><TaskDetail/></RequireAuth>}/>
                <Route path="/admin" element={<RequireRole role="Admin"><AdminHome/></RequireRole>}/>
                <Route path="/admin/users" element={<RequireRole role="Admin"><AdminUsers/></RequireRole>}/>
                <Route path="/admin/labels" element={<RequireRole role="Admin"><AdminLabels/></RequireRole>}/>
                <Route path="/admin/wip-limits" element={<RequireRole role="Admin"><AdminWipLimits/></RequireRole>}/>
                <Route path="/admin/agent-tokens" element={<RequireRole role="Admin"><AdminAgentTokens/></RequireRole>}/>
                <Route path="/admin/notifications" element={<RequireRole role="Admin"><AdminNotifications/></RequireRole>}/>
            </Routes>
        </>
    )
}