/**
 * Lista de temas con audio AUTORIZADO por el propietario (30–60 s por tema).
 * Coloca los archivos en `public/audio/` y añádelos aquí. Mientras la lista esté vacía,
 * "Escuchar" reproduce un beat sintético original de demostración y la interfaz lo indica.
 *
 * Importante: Spotify, YouTube o Muso no entregan audio analizable; hacen falta archivos propios.
 */
export interface Track {
  title: string;
  artist: string;
  /** Ruta relativa, p. ej. "./audio/historia-preview.mp3". */
  src: string;
}

export const TRACKS: Track[] = [];
