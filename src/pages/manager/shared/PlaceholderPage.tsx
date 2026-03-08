type PlaceholderPageProps = {
  title: string;
  description: string;
};

export default function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <section
      style={{
        border: '1.5px solid rgba(62,35,94,.24)',
        borderRadius: 12,
        background: '#fff',
        boxShadow: '0 8px 14px rgba(0,0,0,.08)',
        padding: 16,
      }}
    >
      <h1
        style={{
          margin: 0,
          color: '#2f2050',
          fontSize: 24,
          fontWeight: 900,
          letterSpacing: '-0.03em',
        }}
      >
        {title}
      </h1>
      <p style={{ margin: '8px 0 0', fontSize: 14, color: '#4b4560' }}>{description}</p>
    </section>
  );
}
