export function PlaceholderPage({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <h1 className="page-title">{title}</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        {subtitle}
      </p>
      <div className="card">
        <p style={{ margin: 0 }}>
          App shell and navigation ready. Detailed features for this section are built in the next phase.
        </p>
      </div>
    </div>
  );
}
