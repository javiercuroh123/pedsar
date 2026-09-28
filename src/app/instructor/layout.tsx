import { PanelShell } from "@/components/layout/panel-shell";
import { requireRol } from "@/lib/auth";

export default async function LayoutInstructor({ children }: LayoutProps<"/instructor">) {
  const usuario = await requireRol("instructor", "administrador");
  return (
    <PanelShell usuario={usuario} portal="instructor">
      {children}
    </PanelShell>
  );
}
