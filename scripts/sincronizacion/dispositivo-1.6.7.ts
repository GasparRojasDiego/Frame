// Un dispositivo con el motor de la 1.6.7 (escritorio) / 1.1.3 (móvil): el que
// seguirá en uso hasta que cada equipo se actualice. Sus módulos son copias
// exactas de ese código (git show 4104044:…); el probador resuelve sus
// importaciones de '@/lib/…' hacia estas copias.
import './entorno';
import { startLiveSync } from './live-sync-1.6.7';
import { pushToCloud } from './sync-1.6.7';
import { collectLocalData } from './storage-snapshot-1.6.7';
import { expose } from './controles';

expose({ version: '1.6.7', startLiveSync, pushToCloud, collectLocalData });
