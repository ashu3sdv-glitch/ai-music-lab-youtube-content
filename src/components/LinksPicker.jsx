// Чекбоксы сохранённых ссылок для вставки в описание (общий кусок для Long/Shorts).
export default function LinksPicker({ links, selected, onChange }) {
  if (!links.length) return null;
  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }
  return (
    <div className="field">
      <label>Ссылки для вставки в описание</label>
      {links.map((l) => (
        <label key={l.id} className="checkbox-row" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={selected.includes(l.id)} onChange={() => toggle(l.id)} style={{ width: "auto" }} />
          <span>{l.name}</span>
        </label>
      ))}
    </div>
  );
}
