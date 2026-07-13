import './App.scss';
import {Routes, Route} from 'react-router';
import Home from "./pages/Home.tsx";
import About from "./pages/About.tsx";
import Board from "./pages/Board.tsx";
import Login from "./pages/Login.tsx";
import TaskDetail from "./pages/TaskDetail.tsx";
import RequireAuth from "./components/RequireAuth.tsx";

export default function App() {
    return (
        <>
            <Routes>
                <Route path="/" element={<Home/>}/>
                <Route path="/about" element={<About/>}/>
                <Route path="/login" element={<Login/>}/>
                <Route path="/board" element={<RequireAuth><Board/></RequireAuth>}/>
                <Route path="/tasks/:taskId" element={<RequireAuth><TaskDetail/></RequireAuth>}/>
            </Routes>
        </>
    )
}