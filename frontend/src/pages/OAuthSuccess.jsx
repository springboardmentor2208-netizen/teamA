import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";

const API_URL = import.meta.env.VITE_API_URL;

function OAuthSuccess({ setIsAuth, setUserProfile }) {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    const token  = params.get("token");
    const role   = params.get("role");
    const userId = params.get("userId");

    if (!token) {
      toast.error("Google login failed");
      navigate("/", { replace: true });
      return;
    }

    // Persist auth data
    localStorage.setItem("token",  token);
    localStorage.setItem("role",   role   || "citizen");
    localStorage.setItem("userId", userId || "");

    // Update App-level auth state so navbar shows immediately
    setIsAuth?.(true);

    // Clean the URL
    window.history.replaceState({}, document.title, "/oauth-success");

    // Fetch profile so navbar gets name + avatar right away
    fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => { if (data?._id) setUserProfile?.(data); })
      .catch(() => {})
      .finally(() => {
        toast.success("Google login successful 🎉");
        navigate(role === "admin" ? "/admin" : "/dashboard", { replace: true });
      });

  }, [params, navigate]);

  return null;
}

export default OAuthSuccess;