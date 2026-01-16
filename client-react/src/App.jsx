import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Callback from "./pages/Callback.jsx";
import Home from "./pages/Home.jsx";
import Tv from "./pages/Tv.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/callback" element={<Callback />} />
      <Route path="/tv" element={<Tv />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
