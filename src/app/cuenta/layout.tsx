import { PanelShell } from "@/components/layout/panel-shell";
import { requireUsuario } from "@/lib/auth";

// Páginas comunes a todos los roles (perfil, notificaciones, contraseña).
export default async function LayoutCuenta({ children }: LayoutProps<"/cuenta">) {
  const usuario = await requireUsuario();
  return (
    <PanelShell usuario={usuario} portal={usuario.rol}>
      {children}
    </PanelShell>
  );
}
