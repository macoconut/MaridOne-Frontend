type HrPlaceholderPageProps = {
  title: string;
};

export default function HrPlaceholderPage({ title }: HrPlaceholderPageProps) {
  return (
    <div>
      <h1>{title}</h1>
      <p>This section is ready for implementation.</p>
    </div>
  );
}
