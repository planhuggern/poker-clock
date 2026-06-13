import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function Callback() {
  const { search } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(search);
    const token = params.get("token");
    const role = params.get("role");

    if (token) {
      localStorage.setItem("poker_token", token);
      if (role) localStorage.setItem("poker_role", role);
    }
    navigate("/", { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
