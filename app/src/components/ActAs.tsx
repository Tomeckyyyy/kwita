import { Avatar } from "./Avatar";

export type Actor = { id: string; name: string; note: string; available: boolean };

export function ActAs({ actors, selected, onSelect }: { actors: Actor[]; selected: string; onSelect: (id: string) => void }) {
  return (
    <nav className="actas" aria-label="Działam jako">
      <span className="actas-label">Działam jako</span>
      <div className="actas-list" role="radiogroup">
        {actors.map((a) => (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={a.id === selected}
            className="actor"
            onClick={() => onSelect(a.id)}
          >
            <Avatar name={a.name} size={28} />
            <span className="actor-text">
              <span className="actor-name">{a.name}</span>
              <span className={a.available ? "actor-note" : "actor-note warn"}>{a.note}</span>
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}
