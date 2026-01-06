/**
 * Servicio de generación de URLs de códigos QR
 * Usa api.qrserver.com para generar QRs dinámicamente
 */

/**
 * Genera la URL de un código QR usando api.qrserver.com
 * @param content - Contenido del QR (eventId/participantDni)
 * @param size - Tamaño en píxeles (default 200)
 * @returns URL de la imagen QR
 */
export function generateQRUrl(content: string, size: number = 200): string {
  const encodedContent = encodeURIComponent(content);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedContent}&format=png`;
}
