import { MapId } from '../interfaces/map_id';

export function buildMapUrl(mapId: MapId) {
  const mapIdComponents = [];
  if (mapId.scope) {
    mapIdComponents.push(`/${mapId.scope}`);
  }
  mapIdComponents.push(`/${mapId.name}`);
  mapIdComponents.push(`.${mapId.provider}`);
  if (mapId.variant) {
    mapIdComponents.push(`.${mapId.variant}`);
  }
  if (mapId.version) {
    mapIdComponents.push(`@${mapId.version}`);
  }

  return mapIdComponents.join('');
}
