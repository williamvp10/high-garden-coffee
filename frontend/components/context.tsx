"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
export type Catalog = {
  countries: { name: string; coffee_type: string }[];
  origin: string;
  selected_model: string;
  openai_configured: boolean;
  tavily_configured: boolean;
  telegram_url: string | null;
  repository_url: string | null;
};
export async function api(path: string, options?: RequestInit) {
  const r = await fetch("/api/bff/" + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.detail || "No se pudo completar la consulta");
  }
  return r.json();
}
const Context = createContext<{
  catalog: Catalog | null;
  role: string;
  ready: boolean;
  error: string;
  login: (key: string) => Promise<void>;
  logout: () => Promise<void>;
}>({
  catalog: null,
  role: "external",
  ready: false,
  error: "",
  login: async () => {},
  logout: async () => {},
});
export function Provider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [role, setRole] = useState("external"),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    (async () => {
      try {
        const s = await api("auth/me");
        setRole(s.role);
        setCatalog(await api("catalog"));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setReady(true);
      }
    })();
  }, []);
  async function login(key: string) {
    const s = await api("auth/session", {
      method: "POST",
      body: JSON.stringify({ internal_key: key }),
    });
    setRole(s.role);
  }
  async function logout() {
    await api("auth/session", { method: "POST", body: "{}" });
    setRole("external");
  }
  return (
    <Context.Provider value={{ catalog, role, ready, error, login, logout }}>
      {children}
    </Context.Provider>
  );
}
export const useGarden = () => useContext(Context);
export const num = (n: number | null | undefined, digits = 1) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("es-CO", { maximumFractionDigits: digits }).format(
        n,
      );
