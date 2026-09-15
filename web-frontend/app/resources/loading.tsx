export default function ResourcesLoading() {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      style={{ minHeight: "100vh", padding: "4rem 1.5rem" }}
    >
      <p role="status">Loading campus resources and availability…</p>
    </main>
  );
}
