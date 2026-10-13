import { Platform, Share } from 'react-native';

/**
 * Entrega un archivo de texto a la persona: en web lo descarga; en el teléfono abre la
 * hoja de compartir del sistema (correo, archivos, WhatsApp…). Nada se sube a terceros
 * sin que la persona elija el destino.
 */
export async function shareTextFile(filename: string, content: string, mime = 'application/json'): Promise<void> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  await Share.share({ title: filename, message: content });
}
