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
import RequireAuth from "./components/RequireAuth.tsx";
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
                <Route path="/tasks/:taskId" element={<RequireAuth><TaskDetail/></RequireAuth>}/>
            </Routes>
        </>
    )
}