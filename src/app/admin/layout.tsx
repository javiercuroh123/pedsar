import { PanelShell } from "@/components/layout/panel-shell";
import { requireRol } from "@/lib/auth";

export default async function LayoutAdmin({ children }: LayoutProps<"/admin">) {
  const usuario = await requireRol("administrador");
  return (
    <PanelShell usuario={usuario} portal="administrador">
      {children}
    </PanelShell>
  );
}
