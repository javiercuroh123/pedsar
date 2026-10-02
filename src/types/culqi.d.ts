/**
 * Globales que cargan los scripts de Culqi en el navegador:
 * Checkout Custom (https://js.culqi.com/checkout-js) y Culqi 3DS (https://3ds.culqi.com).
 */
interface CulqiCheckoutInstancia {
  /** Se llama cuando el checkout produce un token, una orden o un error. */
  culqi: () => void;
  token?: { id: string; email?: string } | null;
  order?: Record<string, unknown> | null;
  error?: { user_message?: string; merchant_message?: string } | null;
  open(): void;
  close(): void;
}

interface CulqiCheckoutConfig {
  settings: { title: string; currency: "PEN"; amount: number; order?: string };
  client?: { email?: string; firstName?: string; lastName?: string };
  options?: {
    lang?: "auto" | "es" | "en";
    installments?: boolean;
    modal?: boolean;
    paymentMethods?: Partial<Record<"tarjeta" | "yape" | "billetera" | "bancaMovil" | "agente" | "cuotealo", boolean>>;
    paymentMethodsSort?: string[];
  };
  appearance?: { theme?: string; menuType?: string; logo?: string; defaultStyle?: Record<string, string> };
}

interface Culqi3DSGlobal {
  publicKey: string;
  settings: { charge: { totalAmount: number; returnUrl: string; currency?: "PEN" }; card: { email: string } };
  options?: { showModal?: boolean; showLoading?: boolean; showIcon?: boolean; style?: Record<string, string> };
  generateDevice(): Promise<string | null>;
  initAuthentication(tokenId: string): void;
  reset(): void;
}

interface Window {
  CulqiCheckout?: new (llavePublica: string, config: CulqiCheckoutConfig) => CulqiCheckoutInstancia;
  Culqi3DS?: Culqi3DSGlobal;
}
