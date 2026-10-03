/** Se vuelve a montar en cada navegación y reproduce la animación de entrada de la página. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animar-pagina">{children}</div>;
}
