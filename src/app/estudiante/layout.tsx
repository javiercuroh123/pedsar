import { PanelShell } from "@/components/layout/panel-shell";
import { requireRol } from "@/lib/auth";

export default async function LayoutEstudiante({ children }: LayoutProps<"/estudiante">) {
  const usuario = await requireRol("estudiante");
  return (
    <PanelShell usuario={usuario} portal="estudiante">
      {children}
    </PanelShell>
  );
}
