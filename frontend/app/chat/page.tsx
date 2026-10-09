"use client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Plus, Square, ExternalLink } from "lucide-react";
import { api, useGarden } from "@/components/context";
type Event = {
  type: string;
  id?: string;
  tool?: string;
  input?: unknown;
  output?: unknown;
  message?: string;
  text?: string;
};
type Message = { id: number; kind: string; content: string };
type Conversation = { id: string; title: string };
function Tools({ events }: { events: Event[] }) {
  const starts = events.filter((e) => e.type === "tool_start");
  return (
    <div className="tools">
      {starts.map((e) => {
        const result = events.find(
          (r) => r.type === "tool_result" && r.id === e.id,
        );
        return (
          <details key={e.id}>
            <summary>
              {result ? "✓" : "◌"} {e.tool?.replaceAll("_", " ")}{" "}
              <span>{result ? "Completado" : "Consultando…"}</span>
            </summary>
            <h4>Consulta</h4>
            <pre>{JSON.stringify(e.input, null, 2)}</pre>
            {result && (
              <>
                <h4>Resultado de la herramienta</h4>
                <pre>
                  {typeof result.output === "string"
                    ? result.output
                    : JSON.stringify(result.output, null, 2)}
                </pre>
              </>
            )}
          </details>
        );
      })}
    </div>
  );
}
export default function Chat() {
  const { catalog, role } = useGarden();
  const [conversations, setConversations] = useState<Conversation[]>([]),
    [selected, setSelected] = useState<string | null>(null),
    [messages, setMessages] = useState<Message[]>([]),
    [events, setEvents] = useState<{ message_id: number; payload: Event }[]>(
      [],
    ),
    [question, setQuestion] = useState(""),
    [pending, setPending] = useState(false),
    [live, setLive] = useState<Event[]>([]),
    [answer, setAnswer] = useState(""),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  const abort = useRef<AbortController | null>(null),
    bottom = useRef<HTMLDivElement>(null);
  const refresh = () => api("conversations").then(setConversations);
  async function load(id: string) {
    const r = await api("conversations/" + id);
    setMessages(r.messages);
    setEvents(r.events);
  }
  useEffect(() => {
    abort.current?.abort();
    setSelected(null);
    setMessages([]);
    setEvents([]);
    setError("");
    refresh().catch((e) => setError(e.message));
    return () => abort.current?.abort();
  }, [role]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [answer, messages.length, live.length]);
  async function send() {
    if (!question.trim() || pending) return;
    const text = question.trim();
    setError("");
    setPending(true);
    setAnswer("");
    setLive([]);
    setStatus("Conectando con Garden…");
    const controller = new AbortController();
    abort.current = controller;
    try {
      let id = selected;
      if (!id) {
        const c = await api("conversations", { method: "POST", body: "{}" });
        id = c.id;
        setSelected(id);
      }
      setQuestion("");
      setMessages((m) => [...m, { id: -1, kind: "user", content: text }]);
      const response = await fetch("/api/bff/conversations/" + id + "/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const e = await response.json();
        throw new Error(e.detail || "El agente no está disponible");
      }
      const reader = response.body!.getReader(),
        decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let end;
        while ((end = buffer.indexOf("\n\n")) >= 0) {
          const frame = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const line = frame.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const event: Event = JSON.parse(line.slice(6));
          if (event.type === "token") setAnswer((a) => a + (event.text || ""));
          if (event.type === "answer") setAnswer(event.text || "");
          if (event.type === "status") setStatus(event.message || "");
          if (event.type === "tool_start" || event.type === "tool_result") {
            setLive((e) => [...e, event]);
            setStatus(
              event.type === "tool_start"
                ? "Consultando " + event.tool?.replaceAll("_", " ")
                : "Interpretando resultados…",
            );
          }
          if (event.type === "error") throw new Error(event.message);
        }
      }
      await load(id!);
      await refresh();
      setAnswer("");
      setLive([]);
    } catch (e) {
      setError(
        (e as Error).name === "AbortError"
          ? "Respuesta detenida. Puedes continuar la conversación."
          : (e as Error).message,
      );
      if (selected) await load(selected).catch(() => {});
    } finally {
      setPending(false);
      setStatus("");
      abort.current = null;
    }
  }
  return (
    <>
      <div className="chat-heading">
        <div>
          <div className="eyebrow">CAFÉ, DATOS Y CONTEXTO</div>
          <h1>Garden.</h1>
          <p className="muted">
            Tu asistente para interpretar el mercado cafetero.
          </p>
        </div>
        {catalog?.telegram_url && (
          <a
            className="button secondary"
            href={catalog.telegram_url}
            target="_blank"
            rel="noreferrer"
          >
            Telegram <ExternalLink size={15} />
          </a>
        )}
      </div>
      {!catalog?.openai_configured && (
        <div className="notice">
          Garden está pendiente de activación. Los dashboards ya están disponibles.
        </div>
      )}
      <div className="chat-layout">
        <aside className="chat-history">
          <button
            className="button secondary"
            disabled={pending}
            onClick={() => {
              setSelected(null);
              setMessages([]);
              setEvents([]);
              setLive([]);
              setAnswer("");
              setError("");
            }}
          >
            <Plus size={16} /> Nueva conversación
          </button>
          <div className="nav-label">CONVERSACIONES</div>
          {conversations.map((c) => (
            <button
              disabled={pending}
              key={c.id}
              className={"conversation " + (c.id === selected ? "chosen" : "")}
              onClick={() => {
                setSelected(c.id);
                setError("");
                load(c.id).catch((e) => setError(e.message));
              }}
            >
              {c.title}
            </button>
          ))}
          {!conversations.length && (
            <p className="small muted">Tus conversaciones aparecerán aquí.</p>
          )}
        </aside>
        <section className="chat-panel">
          <div className="chat-messages">
            {!messages.length && (
              <div className="chat-welcome">
                <span className="garden-mark">G</span>
                <h2>¿Qué quieres explorar?</h2>
                <p className="muted">
                  Consulta el histórico, una proyección o información de
                  internet con fuentes.
                </p>
                <div className="suggestions">
                  {[
                    "Proyecta el consumo de Vietnam a cinco años y explica sus límites.",
                    "Compara el histórico de Brasil e Indonesia.",
                    "Busca tendencias recientes del mercado del café y cita las fuentes.",
                  ].map((q) => (
                    <button key={q} onClick={() => setQuestion(q)}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <article key={m.id} className={"message " + m.kind}>
                <div className="message-label">
                  {m.kind === "user" ? "Tú" : "Garden"}
                </div>
                <ReactMarkdown skipHtml>{m.content}</ReactMarkdown>
                {m.kind === "user" && (
                  <Tools
                    events={events
                      .filter((e) => e.message_id === m.id)
                      .map((e) => e.payload)}
                  />
                )}
              </article>
            ))}
            {pending && (
              <article className="message assistant">
                <div className="message-label">Garden</div>
                <div className="activity" role="status">
                  <span className="dot pulse" />
                  {status}
                </div>
                <Tools events={live} />
                {answer && <ReactMarkdown skipHtml>{answer}</ReactMarkdown>}
              </article>
            )}
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            <div ref={bottom} />
          </div>
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <label className="sr-only" htmlFor="question">
              Mensaje para Garden
            </label>
            <textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Pregunta sobre café, consumo o proyecciones…"
              rows={2}
              maxLength={4000}
              disabled={pending || !catalog?.openai_configured}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            {pending ? (
              <button
                type="button"
                className="send"
                aria-label="Detener respuesta"
                onClick={() => abort.current?.abort()}
              >
                <Square size={18} />
              </button>
            ) : (
              <button
                className="send"
                aria-label="Enviar mensaje"
                disabled={!question.trim() || !catalog?.openai_configured}
              >
                <Send size={18} />
              </button>
            )}
          </form>
          <p className="chat-disclaimer">
            {role === "internal"
              ? "Acceso interno · incluye evaluación del experimento"
              : "Acceso público"}{" "}
            · Se muestran herramientas y resultados, sin razonamiento privado.
            Datos hasta 2019/20.
          </p>
        </section>
      </div>
    </>
  );
}
