"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, ReactNode } from "react";
import {
  Coffee,
  House,
  ChartNoAxesCombined,
  FlaskConical,
  NotebookText,
  MessagesSquare,
  ArrowUpRight,
  LockKeyhole,
  X,
} from "lucide-react";
import { Provider, useGarden } from "./context";
const links = [
  ["/", "Inicio", House],
  ["/predicciones", "Predicciones", ChartNoAxesCombined],
  ["/experimento", "Experimento", FlaskConical],
  ["/notebook", "Notebook", NotebookText],
  ["/chat", "Garden · Asistente", MessagesSquare],
] as const;
function Frame({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { catalog, role, ready, error, login, logout } = useGarden();
  const [modal, setModal] = useState(false),
    [key, setKey] = useState(""),
    [authError, setAuthError] = useState("");
  return (
    <div className="app">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-icon">
            <Coffee size={24} />
          </span>
          <span>
            High Garden<small>COFFEE INTELLIGENCE</small>
          </span>
        </Link>
        <div className="nav-label">EXPLORAR</div>
        <nav>
          {links.map(([href, label, Icon]) => (
            <Link
              key={href}
              href={href}
              className={path === href ? "nav-item active" : "nav-item"}
            >
              <Icon size={19} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="environment">
            <span className="dot" /> Experimento reproducible
            <small>Datos hasta 2019/20</small>
          </div>
          {catalog?.telegram_url ? (
            <a
              className="external-link"
              href={catalog.telegram_url}
              target="_blank"
              rel="noreferrer"
            >
              Probar en Telegram <ArrowUpRight size={16} />
            </a>
          ) : (
            <span className="muted small">Telegram por configurar</span>
          )}
          {catalog?.repository_url && (
            <a
              className="external-link"
              href={catalog.repository_url}
              target="_blank"
              rel="noreferrer"
            >
              Repositorio <ArrowUpRight size={16} />
            </a>
          )}
          <button
            className="role-button"
            onClick={() => (role === "internal" ? logout() : setModal(true))}
          >
            <LockKeyhole size={15} />
            {role === "internal" ? "Interno · salir" : "Acceso interno"}
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <span>
            High Garden /{" "}
            <strong>
              {links.find((l) => l[0] === path)?.[1] || "Plataforma"}
            </strong>
          </span>
          <button
            className="badge"
            onClick={() => (role === "internal" ? logout() : setModal(true))}
          >
            {role === "internal" ? "Uso interno" : "Vista pública"}
          </button>
        </header>
        <div className="content">
          {!ready ? (
            <div className="loading">Conectando con la API…</div>
          ) : error ? (
            <div className="error">
              {error}. Verifica que la API esté activa.{" "}
              <button onClick={() => location.reload()}>Reintentar</button>
            </div>
          ) : (
            children
          )}
        </div>
      </main>
      {modal && (
        <div className="modal-backdrop">
          <form
            role="dialog"
            aria-modal="true"
            aria-label="Acceso interno"
            onKeyDown={(e) => {
              if (e.key === "Escape") setModal(false);
            }}
            className="modal"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await login(key);
                setModal(false);
                setKey("");
                setAuthError("");
              } catch (e) {
                setAuthError((e as Error).message);
              }
            }}
          >
            <button
              type="button"
              className="close"
              aria-label="Cerrar"
              onClick={() => setModal(false)}
            >
              <X />
            </button>
            <h2>Acceso interno</h2>
            <p className="muted">
              Ingresa la clave de acceso configurada para el equipo.
            </p>
            <label htmlFor="internal-key">Clave interna</label>
            <input
              id="internal-key"
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              required
              autoFocus
              autoComplete="current-password"
            />
            {authError && <p className="error">{authError}</p>}
            <button className="button">Continuar</button>
          </form>
        </div>
      )}
    </div>
  );
}
export default function Shell({ children }: { children: ReactNode }) {
  return (
    <Provider>
      <Frame>{children}</Frame>
    </Provider>
  );
}
