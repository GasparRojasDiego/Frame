// Un dispositivo con el motor de sincronización ACTUAL (el de src/).
import './entorno';
import { startLiveSync } from '@/lib/supabase/live-sync';
import { pushToCloud } from '@/lib/supabase/sync';
import { collectLocalData } from '@/lib/storage-snapshot';
import { localizePlaylists, rememberSongKeys } from '@/lib/song-keys';
import { setEntityImage, startImageRefs } from '@/lib/image-refs';
import { IMAGE_UPDATED_EVENT, getImageRecord } from '@/lib/music-db';
import type { Song } from '@/types';
import { expose } from './controles';

expose({
  version: 'actual',
  startLiveSync,
  pushToCloud,
  collectLocalData,
  rememberSongKeys: (uid, songs) => rememberSongKeys(uid, songs as Song[]),
  localizePlaylists,
  images: { startImageRefs, setEntityImage, getImageRecord, updatedEvent: IMAGE_UPDATED_EVENT },
});
