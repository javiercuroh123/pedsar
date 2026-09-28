import Script from "next/script";
import { publicEnv } from "@/lib/env";

/**
 * Google Analytics 4 (y espacio para Meta Pixel). Solo se carga si hay ID
 * configurado. TODO: condicionar a consentimiento de cookies (Ley N° 29733).
 */
export function Analitica() {
  const gaId = publicEnv.NEXT_PUBLIC_GA_ID;
  if (!gaId) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
      <Script id="ga4" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`}
      </Script>
    </>
  );
}
