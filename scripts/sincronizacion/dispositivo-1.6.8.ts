// Un dispositivo con el motor de la 1.6.8 (escritorio) / 1.1.4 (móvil): el que
// seguirá en uso hasta que cada equipo se actualice a la 1.6.9 / 1.1.5. Sus
// módulos son copias exactas de ese código (git show ce58845:…); el probador
// resuelve sus importaciones de '@/lib/…' hacia estas copias.
import './entorno';
import { startLiveSync } from './live-sync-1.6.8';
import { pushToCloud } from './sync-1.6.8';
import { collectLocalData } from './storage-snapshot-1.6.8';
import { expose } from './controles';

expose({ version: '1.6.8', startLiveSync, pushToCloud, collectLocalData });
