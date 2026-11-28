import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/auth";

export const messages = {
  "error.auth.serviceUnavailable":
    "StarBot no pudo acceder al servicio de cuentas. Comprueba que la API esté en funcionamiento e inténtalo de nuevo.",

  "error.auth.sessionTimeout": "StarBot no respondió a tiempo. Comprueba tu conexión a internet y vuelve a intentarlo.",

  "error.auth.networkBlocked":
    "Un cortafuegos o proxy de esta red impidió que StarBot accediera a {host}. Pide al administrador de la red que permita {host} e inténtalo de nuevo.",

  "error.auth.signInFirst": "Primero inicia sesión en StarBot.",

  "error.auth.signInRequired": "Es necesario iniciar sesión.",
  "error.auth.chatColorUnavailable":
    "El servicio de cuentas todavía no admite colores de chat. Inténtalo de nuevo más tarde.",
  "error.auth.accountChangedDuringRegister":
    "La cuenta con sesión iniciada cambió mientras se registraba este servidor.",
  "error.auth.hostCredentialUnavailable":
    "La credencial del host remoto no está disponible. Registra el host de nuevo.",
  "error.auth.codeNotVerified": "No se pudo verificar el código de inicio de sesión.",
  "error.auth.serviceError": "El servicio de cuentas devolvió un error.",
  "error.auth.serviceUnreachable":
    "StarBot no pudo acceder al servicio de cuentas. Comprueba tu conexión e inténtalo de nuevo.",

  "error.auth.serviceTimeout": "El servicio de cuentas no respondió a tiempo. Inténtalo de nuevo.",
  "error.auth.serviceStatus": "El servicio de cuentas devolvió un error ({status}). Inténtalo de nuevo más tarde.",
  "error.auth.invalidHostedServer": "El servicio de cuentas devolvió un servidor alojado no válido.",
  "error.auth.invalidServerClaim": "El servicio de cuentas devolvió un código de servidor no válido.",
  "error.auth.codeNotSent": "StarBot no pudo enviar el código de inicio de sesión.",

  "error.auth.deliveryTimeout":
    "StarBot no pudo confirmar la entrega a tiempo. El código aún puede llegar; comprueba la entrega antes de enviarlo de nuevo.",

  "error.auth.deliveryInterrupted":
    "La conexión terminó antes de que StarBot confirmara la entrega. Comprueba la entrega para evitar enviar otro código.",

  "error.auth.deliveryUnknown":
    "StarBot no pudo confirmar si se envió el código de inicio de sesión. Comprueba la entrega antes de enviarlo de nuevo.",
} as const satisfies PartialTranslation<typeof source>;
