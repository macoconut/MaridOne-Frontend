type AccountingPlaceholderPageProps = {
  title: string;
};

export default function AccountingPlaceholderPage({ title }: AccountingPlaceholderPageProps) {
  return (
    <section
      style={{
        border: '1.5px solid rgba(0, 0, 0, 0.22)',
        borderRadius: 12,
        background: '#fff',
        boxShadow: '0 8px 15px rgba(0, 0, 0, 0.08)',
        padding: 20,
      }}
    >
      <h1 style={{ margin: 0, color: '#2f2050', fontSize: 28 }}>{title}</h1>
      <p style={{ marginTop: 10, color: '#4a3e5e' }}>
        Blank placeholder for now. This section stays ready for backend endpoint testing.
      </p>
    </section>
  );
}
